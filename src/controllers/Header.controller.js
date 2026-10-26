// src/controllers/Header.controller.js
import { createHeaderView, MENU_PAGES } from "../ui/components/Header.view.js";
import { setLanguage } from "../language/i18n.js";
import { subscribeAvatar } from "../data/avatar.js";
import { isAdmin, isTester } from "../data/user.repo.js";
// Signs every API request on this page with the player's token.
import "../api/session.js";

const HREF = Object.fromEntries(MENU_PAGES.flat().filter((p) => p.href).map((p) => [p.id, p.href]));
HREF.lab = "./lab.html";
HREF.admin = "./admin.html";

/**
 * The page header and its menu. The menu is the same on every page and does
 * its own navigating, so a page only says which one it is (`current`) and
 * what logging out has to stop first.
 *
 * `onChallenge` replaces the default challenge entry. The map passes one,
 * since it shows a joined challenge itself; anywhere else the modal opens
 * here and joining lands on the map's challenge tab (`index.html#challenge`).
 */
export function Header({
  user,
  level = 1,
  current = null,
  onMenu,
  onLogout,
  onChallenge,
} = {}) {
  const view = createHeaderView({ user, level, current });

  view.setOnMenuToggle(() => { (onMenu || (() => {}))(); });

  view.setOnPage(async (id) => {
    if (id !== "challenge") {
      location.href = HREF[id];
      return;
    }
    if (onChallenge) { onChallenge(); return; }
    // Loaded on demand: most visits to most pages never open it.
    const { ChallengeModal } = await import("./ChallengeModal.controller.js");
    document.body.appendChild(ChallengeModal({
      onJoined: () => { location.href = `${HREF.map}#challenge`; },
    }));
  });

  view.setOnSettings(async () => {
    const { openSettingsModal } = await import("./SettingsModal.controller.js");
    openSettingsModal();
  });

  // The header watches the avatar itself, from `setUser` on, so every page
  // shows it without each one wiring a subscription; logout stops it before
  // the page's own handler signs out.
  let stopAvatar = () => {};
  function watchAvatar(uid) {
    stopAvatar();
    stopAvatar = uid ? subscribeAvatar(uid, (avatar) => view.setAvatar(avatar)) : () => {};
  }

  view.setOnLogout(() => { watchAvatar(null); (onLogout || (() => {}))(); });

  // keep dropdown in sync with current doc lang
  const currentLang = document.documentElement.lang || "en";
  view.setLanguageValue(currentLang);
  view.refreshI18n();

  // do the real app behavior here
  view.setOnLanguageChange(async (lang) => {
    try {
      await setLanguage(lang);

      // sync UI + translated labels
      view.setLanguageValue(lang);
      view.refreshI18n();
    } catch (e) {
      console.error("Failed to switch language:", e);
    }
  });

  const el = view.element;
  el.setUser = (u) => {
    view.setUser(u);
    watchAvatar(u?.uid ?? null);
    // The admin entry for an admin only; the field lab for a tester, or an admin.
    if (!u?.uid) {
      view.setAdmin(false);
      view.setLab(false);
      return;
    }
    const admin = isAdmin(u.uid).catch(() => false);
    admin.then((a) => view.setAdmin(a));
    Promise.all([admin, isTester()]).then(([a, tester]) => view.setLab(a || tester));
  };
  el.setLevel = (lvl) => view.setLevel(lvl);
  return el;
}
