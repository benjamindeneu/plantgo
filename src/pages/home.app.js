// src/pages/home_test.app.js
import { initI18n, translateDom } from "../language/i18n.js";

import { Header } from "../controllers/Header.controller.js";
import { IdentifyPanel } from "../controllers/IdentifyPanel.controller.js";
import { ChallengePanel } from "../controllers/ChallengePanel.controller.js";
import { MissionsPanel } from "../controllers/MissionsPanel.controller.js";
import { ChallengeModal } from "../controllers/ChallengeModal.controller.js";
import { listenUserLevel } from "../user/level.js";

import { auth } from "../../firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";

await initI18n();

function App() {
  let stopLevel = () => {};

  // --- Header ---
  const headerMount = document.getElementById("appHeader");
  const header = Header({
    user: null,
    level: 1,
    onMenu: () => {},
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
