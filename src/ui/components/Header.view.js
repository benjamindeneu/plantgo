// src/ui/components/Header.view.js

/**
 * Pure view for the header.
 * - Renders the DOM
 * - Manages visual toggle of the menu
 * - Exposes event hooks for controller
 */

import { t } from "../../language/i18n.js";
import { avatarImg } from "./Avatar.view.js";

/**
 * Every page the menu leads to, in menu order, in groups: the map and what
 * hangs off it, then the player's own collection. `id` is what a page passes
 * as `current`.
 */
export const MENU_PAGES = [
  [
    { id: "map",          icon: "🗺️", key: "header.map",          href: "./index.html" },
    { id: "species",      icon: "🌼", key: "header.species",      href: "./species.html" },
    { id: "challenge",    icon: "🏁", key: "header.challenge" },  // a modal, not a page
  ],
  [
    { id: "herbarium",    icon: "📗", key: "header.herbarium",    href: "./plantdex.html" },
    { id: "observations", icon: "📋", key: "header.observations", href: "./observations.html" },
    { id: "badges",       icon: "🏅", key: "header.badges",       href: "./badges.html" },
    { id: "avatar",       icon: "🧑", key: "header.avatar",       href: "./avatar.html" },
    { id: "quiz",         icon: "🌿", key: "header.quiz",         href: "./quiz.html" },
  ],
];

/**
 * The same menu on every page, so any page is one tap from any other rather
 * than two by way of the map. The page on screen is marked rather than left
 * out, so the list never reshuffles from one page to the next.
 */
export function createHeaderView({
  user,
  level = 1,
  current = null, // a MENU_PAGES id, "lab" or "admin"
} = {}) {
  const pageItems = MENU_PAGES.map((group) => group.map((p) =>
    `<button class="menu-item" role="menuitem" type="button" data-page="${p.id}"></button>`
  ).join("")).join(`<div class="menu-divider"></div>`);

  const root = document.createElement("header");
  root.className = "nav";
  root.innerHTML = `
    <a class="brandmark" id="brandmark" href="./index.html">
      <img src="./assets/plantgo_logo2.png" alt="PlantGo logo" class="brand-logo">
      <img src="./assets/plantgo_titleimage_1.png" alt="PlantGo" class="brand-title">
    </a>
    <div class="user-area">
      <div class="user-info">
        <a class="user-avatar" id="userAvatar" href="./avatar.html"></a>
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
        ${pageItems}
        <div class="menu-divider"></div>
        <button class="menu-item" role="menuitem" type="button" id="menuSettings"></button>
        <button class="menu-item" role="menuitem" type="button" id="menuLab" data-page="lab" hidden></button>
        <button class="menu-item" role="menuitem" type="button" id="menuAdmin" data-page="admin" hidden></button>
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
        <button class="menu-item danger" role="menuitem" type="button" id="menuLogout"></button>
      </div>
    </div>
  `;

  const btn = root.querySelector("#menuBtn");
  const menu = root.querySelector("#userMenu");
  const levelEl = root.querySelector("#levelNumber");
  const levelLabelEl = root.querySelector("#levelLabel");
  const nameEl = root.querySelector(".user-name");
  const logoutBtn = root.querySelector("#menuLogout");
  const langSelect = root.querySelector("#langSelect");
  const avatarEl = root.querySelector("#userAvatar");
  const settingsMenuBtn = root.querySelector("#menuSettings");
  const adminMenuBtn = root.querySelector("#menuAdmin");
  const labMenuBtn = root.querySelector("#menuLab");
  const pageButtons = [...root.querySelectorAll("[data-page]")];

  for (const b of pageButtons) {
    if (b.dataset.page !== current) continue;
    b.classList.add("is-current");
    b.setAttribute("aria-current", "page");
  }

  // callbacks set by controller
  let onMenuToggle = null;
  let onPage = null;
  let onLogout = null;
  let onLanguageChange = null;
  let onSettings = null;

  function toggleMenu(force) {
    const willOpen = force !== undefined ? force : !menu.classList.contains("show");
    menu.classList.toggle("show", willOpen);
    btn.setAttribute("aria-expanded", String(willOpen));
    if (onMenuToggle) onMenuToggle(willOpen);
  }

  // Apply translated strings (called on init + after language changes)
  function refreshI18n() {
    // fallback user label if no displayName
    if (!user?.displayName) nameEl.textContent = t("header.user");

    levelLabelEl.textContent = t("header.levelShort");

    for (const p of MENU_PAGES.flat()) {
      root.querySelector(`[data-page="${p.id}"]`).textContent = `${p.icon} ${t(p.key)}`;
    }
    settingsMenuBtn.textContent = `⚙ ${t("settings.title")}`;
    labMenuBtn.textContent = `🧪 ${t("header.lab")}`;
    adminMenuBtn.textContent = `🛡 ${t("header.admin")}`;
    logoutBtn.textContent = `🚪 ${t("header.logout")}`;
    langSelect.setAttribute("aria-label", t("header.language"));
    avatarEl.setAttribute("aria-label", t("header.avatar"));
  }

  document.addEventListener("i18n:changed", () => {
    refreshI18n();
  });

  // local UI wiring (no business logic)
  btn.addEventListener("click", () => toggleMenu());
  document.addEventListener("click", (e) => {
    if (!root.contains(e.target)) toggleMenu(false);
  });

  // The page already on screen only closes the menu: reloading it would
  // throw away whatever the player was looking at.
  for (const b of pageButtons) {
    b.addEventListener("click", () => {
      toggleMenu(false);
      if (b.dataset.page !== current) onPage?.(b.dataset.page);
    });
  }

  logoutBtn.addEventListener("click", () => {
    toggleMenu(false);
    if (onLogout) onLogout();
  });

  // language dropdown -> emit to controller
  langSelect.addEventListener("change", () => {
    if (onLanguageChange) onLanguageChange(langSelect.value);
  });

  settingsMenuBtn.addEventListener("click", () => {
    toggleMenu(false);
    if (onSettings) onSettings();
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
    // The chip stays empty until the avatar is known, so a page never
    // flashes the default outfit before the player's own.
    setAvatar(avatar) {
      avatarEl.innerHTML = avatar ? avatarImg(avatar, { className: "av user-avatar__svg", small: true, px: 28 }) : "";
    },
    // The admin tab is there only for an admin, the field lab for a field
    // tester (or an admin); everyone else never sees either.
    setAdmin(isAdmin) {
      adminMenuBtn.hidden = !isAdmin;
    },
    setLab(visible) {
      labMenuBtn.hidden = !visible;
    },

    // allow controller to set/get lang UI state
    setLanguageValue(lang) {
      langSelect.value = lang;
    },

    // let controller re-apply translated strings after setLanguage(...)
    refreshI18n,

    setOnMenuToggle(cb) { onMenuToggle = cb; },
    /** Another page's entry (a MENU_PAGES id, "lab" or "admin") was picked. */
    setOnPage(cb) { onPage = cb; },
    setOnLogout(cb) { onLogout = cb; },
    setOnLanguageChange(cb) { onLanguageChange = cb; },
    setOnSettings(cb) { onSettings = cb; },
  };
}
