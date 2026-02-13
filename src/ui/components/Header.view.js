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
      <select class="user-btn menu-item" id="langSelect" aria-label="Language">
        <option value="en">EN</option>
        <option value="fr">FR</option>
        <option value="de">DE</option>
        <option value="it">IT</option>
        <option value="pt">PT</option>
      </select>
      <button id="userBtn" class="user-btn" aria-haspopup="menu" aria-expanded="false" type="button">
        <span class="user-name">${user?.displayName ?? "User"}</span>
        <span class="level-badge">
          <span id="levelLabel">Lv.</span> <span id="levelNumber">${level}</span>
        </span>
      </button>

      <div id="userMenu" class="menu" role="menu" style="display:none">
        ${
          isHerbarium
            ? `<button class="menu-item" role="menuitem" id="menuHome">🏠 Main</button>`
            : `<button class="menu-item" role="menuitem" id="menuHerbarium">📗 Herbarium</button>`
        }
        <button class="menu-item danger" role="menuitem" id="menuLogout">🚪 Log out</button>
      </div>
    </div>
  `;

  const btn = root.querySelector("#userBtn");
  const menu = root.querySelector("#userMenu");
  //const brandEl = root.querySelector("#brandmark");
  const levelEl = root.querySelector("#levelNumber");
  const levelLabelEl = root.querySelector("#levelLabel");
  const nameEl = root.querySelector(".user-name");
  const primaryNavBtn = root.querySelector(isHerbarium ? "#menuHome" : "#menuHerbarium");
  const logoutBtn = root.querySelector("#menuLogout");
  const langSelect = root.querySelector("#langSelect");

  // callbacks set by controller
  let onMenuToggle = null;
  let onPrimaryNav = null;
  let onLogout = null;
  let onLanguageChange = null;

  function toggleMenu(force) {
    const willOpen = force !== undefined ? force : menu.style.display === "none";
    menu.style.display = willOpen ? "block" : "none";
    btn.setAttribute("aria-expanded", String(willOpen));
    if (onMenuToggle) onMenuToggle(willOpen);
  }

  // Apply translated strings (called on init + after language changes)
  function refreshI18n() {
    //if (brandEl) brandEl.textContent = `🌿 ${t("app.title")}`;

    // fallback user label if no displayName
    if (!user?.displayName) nameEl.textContent = t("header.user");

    if (levelLabelEl) levelLabelEl.textContent = t("header.levelShort");

    if (primaryNavBtn) {
      primaryNavBtn.textContent = isHerbarium
        ? `🏠 ${t("header.main")}`
        : `📗 ${t("header.herbarium")}`;
    }

    if (logoutBtn) logoutBtn.textContent = `🚪 ${t("header.logout")}`;

    if (langSelect) langSelect.setAttribute("aria-label", t("header.language"));
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
  };
}
