// src/pages/badges.app.js
import { initI18n } from "../language/i18n.js";
import { applyEventTheme } from "../data/events.js";
import { Header } from "../controllers/Header.controller.js";
import { BadgesPanel } from "../controllers/Badges.controller.js";
import { listenUserLevel } from "../user/level.js";

import { auth } from "../../firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";

await initI18n();
// Dress the page for the running event, if any.
applyEventTheme();

function App() {
  let stopLevel = () => {};

  const headerMount = document.getElementById("appHeader");
  const header = Header({
    user: null,
    level: 1,
    current: "badges",
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

  const badgesMount = document.getElementById("badgesRoot");
  badgesMount.replaceWith(BadgesPanel());

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
