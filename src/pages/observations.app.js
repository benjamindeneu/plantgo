// src/pages/observations.app.js
import { initI18n } from "../language/i18n.js";
import { Header } from "../controllers/Header.controller.js";
import { ObservationsHistoryPanel } from "../controllers/ObservationsHistory.controller.js";
import { listenUserLevel } from "../user/level.js";

import { auth } from "../../firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";

await initI18n();

function App() {
  let stopLevel = () => {};

  const headerMount = document.getElementById("appHeader");
  const header = Header({
    user: null,
    level: 1,
    menuVariant: "herbarium",
    onBackHome: () => { location.href = "./index.html"; },
    onBadges: () => { location.href = "./badges.html"; },
    onQuiz: () => { location.href = "./quiz.html"; },
    onLogout: async () => {
      try {
        stopLevel();
        await signOut(auth);
        location.replace("./login.html");
      } catch (e) {
        alert(e.message);
      }
    }
  });
  headerMount.replaceWith(header);

  const listMount = document.getElementById("observationsList");
  listMount.replaceWith(ObservationsHistoryPanel());

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
