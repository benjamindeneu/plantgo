// src/pages/map.app.js — bootstrap for the front page (index.html).
//
// The mission map is the app's main screen: it owns the full header menu and
// the modals that used to hang off the old home page.
import { initI18n } from "../language/i18n.js";
import { applyEventTheme } from "../data/events.js";
import { Header } from "../controllers/Header.controller.js";
import { MapPage } from "../controllers/MapPage.controller.js";
import { ChallengeModal } from "../controllers/ChallengeModal.controller.js";
import { openSettingsModal } from "../controllers/SettingsModal.controller.js";
import { LocationGate } from "../ui/components/LocationGate.js";
import { listenUserLevel } from "../user/level.js";
import { isAdmin } from "../data/user.repo.js";
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
  let panel = null;
  let booted = false;

  const headerMount = document.getElementById("appHeader");
  const header = Header({
    user: null,
    level: 1,
    onBadges: () => { location.href = "./badges.html"; },
    onAvatar: () => { location.href = "./avatar.html"; },
    onQuiz: () => { location.href = "./quiz.html"; },
    onHerbarium: () => { location.href = "./plantdex.html"; },
    onObservations: () => { location.href = "./observations.html"; },
    onChallenge: () => {
      // Creating or joining lands the player on the challenge screen; the tab
      // itself appears on its own as soon as Firestore reports the pointer.
      document.body.appendChild(ChallengeModal({ onJoined: () => panel?.showChallenge() }));
    },
    onSettings: () => openSettingsModal(),
    onAdmin: () => { location.href = "./admin.html"; },
    onLogout: async () => {
      try {
        stopLevel();
        panel?.stop();
        await signOut(auth);
        location.replace("./login.html");
      } catch (e) {
        alert(e.message);
      }
    },
  });
  headerMount.replaceWith(header);

  const mount = document.getElementById("mapRoot");

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      stopLevel();
      location.replace("./login.html");
      return;
    }

    header.setUser(user);
    stopLevel();
    stopLevel = listenUserLevel(user.uid, (lvl) => header.setLevel(lvl));
    isAdmin(user.uid).then((admin) => header.setAdmin(admin)).catch(() => {});

    // `onAuthStateChanged` fires again on token refresh, and a second call
    // used to build a second map — whose `start()` recentred on the GPS fix —
    // over the one being used.
    if (booted) return;
    booted = true;

    panel = MapPage();
    mount.replaceChildren(panel.element);
    // Leaflet measures its container on init, so size it before starting.
    requestAnimationFrame(() => {
      panel.invalidate();
      panel.start();
    });
  });

  window.addEventListener("resize", () => panel?.invalidate());
}

App();
export default App;
