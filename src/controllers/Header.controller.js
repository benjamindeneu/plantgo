// src/controllers/Header.controller.js
import { createHeaderView } from "../ui/components/Header.view.js";
import { setLanguage } from "../language/i18n.js";
import { subscribeAvatar } from "../data/avatar.js";

export function Header({
  user,
  level = 1,
  menuVariant = "main",
  onMenu,
  onLogout,
  onHerbarium,
  onBackHome,
  onChallenge,
  onBadges,
  onAvatar,
  onQuiz,
  onSettings,
  onObservations,
  onAdmin,
} = {}) {
  const view = createHeaderView({ user, level, menuVariant });

  view.setOnMenuToggle(() => { (onMenu || (() => {}))(); });

  view.setOnPrimaryNav(() => {
    if (menuVariant === "herbarium") (onBackHome || (() => {}))();
    else (onHerbarium || (() => {}))();
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

  view.setOnChallenge(() => { (onChallenge || (() => {}))(); });

  view.setOnBadges(() => { (onBadges || (() => {}))(); });
  view.setOnAvatar(() => { (onAvatar || (() => {}))(); });

  view.setOnQuiz(() => { (onQuiz || (() => {}))(); });
  view.setOnSettings(() => { (onSettings || (() => {}))(); });
  view.setOnObservations(() => { (onObservations || (() => {}))(); });
  view.setOnAdmin(() => { (onAdmin || (() => {}))(); });

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
  el.setUser = (u) => { view.setUser(u); watchAvatar(u?.uid ?? null); };
  el.setLevel = (lvl) => view.setLevel(lvl);
  el.setAdmin = (isAdmin) => view.setAdmin(isAdmin);
  return el;
}
