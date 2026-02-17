// src/controllers/Header.controller.js
import { createHeaderView } from "../ui/components/Header.view.js";
import { setLanguage } from "../language/i18n.js";

export function Header({
  user,
  level = 1,
  menuVariant = "main",
  onMenu,
  onLogout,
  onHerbarium,
  onBackHome,
  onChallenge,
} = {}) {
  const view = createHeaderView({ user, level, menuVariant });

  view.setOnMenuToggle(() => { (onMenu || (() => {}))(); });

  view.setOnPrimaryNav(() => {
    if (menuVariant === "herbarium") (onBackHome || (() => {}))();
    else (onHerbarium || (() => {}))();
  });

  view.setOnLogout(() => { (onLogout || (() => {}))(); });

  view.setOnChallenge(() => { (onChallenge || (() => {}))(); });

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
  el.setUser = (u) => view.setUser(u);
  el.setLevel = (lvl) => view.setLevel(lvl);
  return el;
}
