// src/pages/old_home.app.js
//
// The pre-map home screen. The mission map took over as the front page and
// this is no longer in the navigation; it is kept reachable by URL because it
// is still the only place the daily-quest strip and the missions list live.
import { initI18n, translateDom } from "../language/i18n.js";

import { Header } from "../controllers/Header.controller.js";
import { IdentifyPanel } from "../controllers/IdentifyPanel.controller.js";
import { ChallengePanel } from "../controllers/ChallengePanel.controller.js";
import { MissionsPanel } from "../controllers/MissionsPanel.controller.js";
import { DailyQuests } from "../controllers/DailyQuests.controller.js";
import { LocationGate } from "../ui/components/LocationGate.js";
import { listenUserLevel } from "../user/level.js";
import { debugMode } from "../data/debugMode.js";

import { auth } from "../../firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";

await initI18n();
// Dress the page for the running event, if any.
applyEventTheme();
debugMode.init();

function App() {
  LocationGate();

  let stopLevel = () => {};

  // --- Header ---
  const headerMount = document.getElementById("appHeader");
  const header = Header({
    user: null,
    level: 1,
    menuVariant: "herbarium", // the map is home now; offer a way back to it
    onBackHome: () => { location.href = "./index.html"; },
    onLogout: async () => {
      try {
        stopLevel();
        await signOut(auth);
        location.replace("./login.html");
      } catch (e) {
        alert(e.message);
      }
    },
  });
  headerMount.replaceWith(header);

  // --- Daily Quests ---
  const dailyQuestsMount = document.getElementById("dailyQuestsRoot");
  dailyQuestsMount.replaceWith(DailyQuests());

  // --- Panels ---
  const identifyMount = document.getElementById("identifyRoot");
  const challengeMount = document.getElementById("challengeRoot");
  const missionsMount = document.getElementById("missionsRoot");

  identifyMount.replaceWith(IdentifyPanel());
  challengeMount.replaceWith(ChallengePanel());
  missionsMount.replaceWith(MissionsPanel());

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
