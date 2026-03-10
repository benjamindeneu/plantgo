// src/pages/home_test.app.js
import { initI18n, translateDom, t } from "../language/i18n.js";
import { getCurrentPosition, watchLocationPermission } from "../data/geo.service.js";

import { Header } from "../controllers/Header.controller.js";
import { IdentifyPanel } from "../controllers/IdentifyPanel.controller.js";
import { ChallengePanel } from "../controllers/ChallengePanel.controller.js";
import { MissionsPanel } from "../controllers/MissionsPanel.controller.js";
import { ChallengeModal } from "../controllers/ChallengeModal.controller.js";
import { DailyQuests } from "../controllers/DailyQuests.controller.js";
import { listenUserLevel } from "../user/level.js";

import { auth } from "../../firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";

await initI18n();

function LocationGate() {
  const overlay = document.createElement('div');
  overlay.className = 'location-gate';
  overlay.setAttribute('aria-live', 'assertive');
  overlay.setAttribute('role', 'alert');
  overlay.innerHTML = `
    <div class="location-gate__card">
      <div class="location-gate__icon">📍</div>
      <h2 class="location-gate__title"></h2>
      <p class="location-gate__message"></p>
    </div>
  `;
  document.body.appendChild(overlay);

  const titleEl = overlay.querySelector('.location-gate__title');
  const msgEl = overlay.querySelector('.location-gate__message');

  const applyTranslations = () => {
    titleEl.textContent = t('location.gate.title');
    msgEl.textContent = t('location.gate.message');
  };
  applyTranslations();
  document.addEventListener('i18n:changed', applyTranslations);

  const show = () => overlay.classList.add('location-gate--visible');
  const hide = () => overlay.classList.remove('location-gate--visible');

  const stopWatch = watchLocationPermission({ onGranted: hide, onDenied: show });

  // Trigger the browser permission prompt immediately; also catch denied state
  // for browsers that don't support the Permissions API.
  getCurrentPosition({ enableHighAccuracy: false, timeout: 10000 })
    .then(hide)
    .catch(err => { if (err.code === 1) show(); });

  return () => {
    stopWatch();
    document.removeEventListener('i18n:changed', applyTranslations);
    overlay.remove();
  };
}

function App() {
  LocationGate();

  let stopLevel = () => {};

  // --- Header ---
  const headerMount = document.getElementById("appHeader");
  const header = Header({
    user: null,
    level: 1,
    onMenu: () => {},
    onBadges: () => { location.href = "./badges.html"; },
    onChallenge: () => {
      const modal = ChallengeModal();
      document.body.appendChild(modal);
    },
    onLogout: async () => {
      try {
        stopLevel();
        await signOut(auth);
        location.replace("./login.html");
      } catch (e) {
        alert(e.message);
      }
    },
    onHerbarium: () => { location.href = "./plantdex.html"; }
  });
  headerMount.replaceWith(header);

  // --- Daily Quests ---
  const dailyQuestsMount = document.getElementById("dailyQuestsRoot");
  dailyQuestsMount.replaceWith(DailyQuests());

  // --- Panels ---
  const identifyMount = document.getElementById("identifyRoot");
  const challengeMount = document.getElementById("challengeRoot");
  const missionsMount = document.getElementById("missionsRoot");

  const identifyPanel = IdentifyPanel();
  const challengePanel = ChallengePanel();
  const missionsPanel = MissionsPanel();

  identifyMount.replaceWith(identifyPanel);
  challengeMount.replaceWith(challengePanel);
  missionsMount.replaceWith(missionsPanel);

  // --- Footer ---
  const footerMount = document.getElementById("appFooter");
  const footer = document.createElement("footer");
  footer.className = "footer";
  footer.innerHTML = `<div class="brand"><img alt="Powered by Pl@ntNet" loading="lazy" src="https://my.plantnet.org/images/powered-by-plantnet-dark.svg"/></div>`;
  footerMount.replaceWith(footer);

  translateDom(document);

  // --- Auth guard + header level sync ---
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      stopLevel();
      location.replace("./login.html");
      return;
    }

    header.setUser(user);

    stopLevel();
    stopLevel = listenUserLevel(user.uid, (lvl) => header.setLevel(lvl));
  });
}

App();
export default App;
