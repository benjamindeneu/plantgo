// src/ui/components/Header.view.js

/**
 * Pure view for the header.
 * - Renders the DOM
 * - Manages visual toggle of the menu
 * - Exposes event hooks for controller
 */

import { t } from "../../language/i18n.js";

export function createHeaderView({
  user,
  level = 1,
  menuVariant = "main", // "main" | "herbarium"
} = {}) {
  const isHerbarium = menuVariant === "herbarium";

  const root = document.createElement("header");
  root.className = "nav";
  root.innerHTML = `
    <div class="brandmark" id="brandmark">
      <img src="./assets/plantgo_logo2.png" alt="PlantGo logo" class="brand-logo">
      <img src="./assets/plantgo_titleimage_1.png" alt="PlantGo" class="brand-title">
    </div>
    <div class="user-area">
      <div class="user-info">
        <span class="user-name">${user?.displayName ?? "User"}</span>
        <span class="level-badge">
          <span id="levelLabel">Lv.</span> <span id="levelNumber">${level}</span>
        </span>
      </div>
    </div>

    <div class="menu-wrap">
      <button id="menuBtn" class="menu-btn" aria-haspopup="menu" aria-expanded="false" type="button" aria-label="Menu">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect x="1" y="3" width="14" height="1.8" rx="0.9" fill="currentColor"/>
          <rect x="1" y="7.1" width="14" height="1.8" rx="0.9" fill="currentColor"/>
          <rect x="1" y="11.2" width="14" height="1.8" rx="0.9" fill="currentColor"/>
        </svg>
        <span class="menu-btn-label">Menu</span>
      </button>

      <div id="userMenu" class="menu" role="menu">
        ${isHerbarium ? `
          <button class="menu-item menu-item--back" role="menuitem" id="menuHome">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M10 12.5L5.5 8 10 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span id="menuHomeLabel">Back to Main</span>
          </button>
        ` : `
          <button class="menu-item" role="menuitem" id="menuHerbarium">📗 Herbarium</button>
          <button class="menu-item" role="menuitem" id="menuObservations">📋 Observations</button>
          <button class="menu-item" role="menuitem" id="menuBadges">🏅 Badges</button>
          <button class="menu-item" role="menuitem" id="menuChallenge">🏁 Challenge</button>
          <button class="menu-item" role="menuitem" id="menuQuiz">🌿 Quiz</button>
          <div class="menu-divider"></div>
          <button class="menu-item" role="menuitem" id="menuSettings">⚙ Settings</button>
          <div class="lang-wrapper">
            <select class="lang-select" id="langSelect" aria-label="Language">
              <option value="en">🇬🇧 EN</option>
              <option value="fr">🇫🇷 FR</option>
              <option value="de">🇩🇪 DE</option>
              <option value="it">🇮🇹 IT</option>
              <option value="es">🇪🇸 ES</option>
              <option value="pt">🇵🇹 PT</option>
            </select>
          </div>
          <div class="menu-divider"></div>
          <button class="menu-item danger" role="menuitem" id="menuLogout">🚪 Log out</button>
        `}
      </div>
    </div>
  `;

  const btn = root.querySelector("#menuBtn");
  const menu = root.querySelector("#userMenu");
  //const brandEl = root.querySelector("#brandmark");
  const levelEl = root.querySelector("#levelNumber");
  const levelLabelEl = root.querySelector("#levelLabel");
  const nameEl = root.querySelector(".user-name");
  const primaryNavBtn = root.querySelector(isHerbarium ? "#menuHome" : "#menuHerbarium");
  const primaryNavLabel = root.querySelector("#menuHomeLabel");
  const logoutBtn = root.querySelector("#menuLogout");
  const langSelect = root.querySelector("#langSelect");
  const challengeMenuBtn = root.querySelector("#menuChallenge");
  const badgesMenuBtn = root.querySelector("#menuBadges");
  const quizMenuBtn = root.querySelector("#menuQuiz");
  const settingsMenuBtn = root.querySelector("#menuSettings");
  const observationsMenuBtn = root.querySelector("#menuObservations");

  // callbacks set by controller
  let onMenuToggle = null;
  let onPrimaryNav = null;
  let onLogout = null;
  let onLanguageChange = null;
  let onChallenge = null;
  let onBadges = null;
  let onQuiz = null;
  let onSettings = null;
  let onObservations = null;

  function toggleMenu(force) {
    const willOpen = force !== undefined ? force : !menu.classList.contains("show");
    menu.classList.toggle("show", willOpen);
    btn.setAttribute("aria-expanded", String(willOpen));
    if (onMenuToggle) onMenuToggle(willOpen);
  }

  // Apply translated strings (called on init + after language changes)
  function refreshI18n() {
    //if (brandEl) brandEl.textContent = `🌿 ${t("app.title")}`;

    // fallback user label if no displayName
    if (!user?.displayName) nameEl.textContent = t("header.user");

    if (levelLabelEl) levelLabelEl.textContent = t("header.levelShort");

    if (isHerbarium) {
      // back button has an SVG inside — only update the text span
      if (primaryNavLabel) primaryNavLabel.textContent = t("header.main");
    } else if (primaryNavBtn) {
      primaryNavBtn.textContent = `📗 ${t("header.herbarium")}`;
    }

    if (logoutBtn) logoutBtn.textContent = `🚪 ${t("header.logout")}`;

    if (langSelect) langSelect.setAttribute("aria-label", t("header.language"));

    if (challengeMenuBtn) { challengeMenuBtn.textContent = `🏁 ${t("header.challenge")}`; }
    if (badgesMenuBtn) { badgesMenuBtn.textContent = `🏅 ${t("header.badges")}`; }
    if (quizMenuBtn) { quizMenuBtn.textContent = `🌿 ${t("header.quiz")}`; }
    if (observationsMenuBtn) { observationsMenuBtn.textContent = `📋 ${t("header.observations")}`; }
  }

  document.addEventListener("i18n:changed", () => {
    refreshI18n();
  });
  
  // local UI wiring (no business logic)
  btn.addEventListener("click", () => toggleMenu());
  document.addEventListener("click", (e) => {
    if (!root.contains(e.target)) toggleMenu(false);
  });

  primaryNavBtn?.addEventListener("click", () => {
    toggleMenu(false);
    if (onPrimaryNav) onPrimaryNav();
  });

  logoutBtn?.addEventListener("click", () => {
    toggleMenu(false);
    if (onLogout) onLogout();
  });

  // language dropdown -> emit to controller
  langSelect?.addEventListener("change", () => {
    if (onLanguageChange) onLanguageChange(langSelect.value);
  });

  challengeMenuBtn?.addEventListener("click", () => {
    toggleMenu(false);
    if (onChallenge) onChallenge();
  });

  badgesMenuBtn?.addEventListener("click", () => {
    toggleMenu(false);
    if (onBadges) onBadges();
  });

  quizMenuBtn?.addEventListener("click", () => {
    toggleMenu(false);
    if (onQuiz) onQuiz();
  });

  settingsMenuBtn?.addEventListener("click", () => {
    toggleMenu(false);
    if (onSettings) onSettings();
  });

  observationsMenuBtn?.addEventListener("click", () => {
    toggleMenu(false);
    if (onObservations) onObservations();
  });

  // initial i18n render
  refreshI18n();

  return {
    element: root,

    // view API for controller
    setUser(u) {
      user = u; // keep local reference for refreshI18n fallback
      nameEl.textContent = u?.displayName ?? t("header.user");
    },
    setLevel(lvl) {
      levelEl.textContent = String(lvl ?? 1);
    },

    // allow controller to set/get lang UI state
    setLanguageValue(lang) {
      if (langSelect) langSelect.value = lang;
    },

    // let controller re-apply translated strings after setLanguage(...)
    refreshI18n,

    setOnMenuToggle(cb) { onMenuToggle = cb; },
    setOnPrimaryNav(cb) { onPrimaryNav = cb; },
    setOnLogout(cb) { onLogout = cb; },
    setOnLanguageChange(cb) { onLanguageChange = cb; },
    setOnChallenge(cb) { onChallenge = cb; },
    setOnBadges(cb) { onBadges = cb; },
    setOnQuiz(cb) { onQuiz = cb; },
    setOnSettings(cb) { onSettings = cb; },
    setOnObservations(cb) { onObservations = cb; },
  };
}
