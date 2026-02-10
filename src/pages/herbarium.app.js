// src/pages/herbarium.app.js

import { initI18n } from "../language/i18n.js";
import { Header } from "../controllers/Header.controller.js";
import { HerbariumPanel } from "../controllers/Herbarium.controller.js";
import { listenUserLevel } from "../user/level.js";

import { auth } from "../../firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";

// ensure dict is loaded + html lang set BEFORE any views render
await initI18n();

function App() {
  // must exist before Header so logout can call it safely
  let stopLevel = () => {};

  // ----- Header (Herbarium variant) -----
  const headerMount = document.getElementById("appHeader");
  const header = Header({
    user: null,
    level: 1,
    menuVariant: "herbarium",
    onBackHome: () => { location.href = "./index.html"; },
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

  // ----- Herbarium list panel -----
  const listMount = document.getElementById("discoveriesList");
  const herbariumPanel = HerbariumPanel();
  listMount.replaceWith(herbariumPanel);

  // ----- Auth guard + header level sync -----
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      stopLevel();
      location.replace("./login.html");
      return;
    }

    header.setUser(user);

    // refresh level listener
    stopLevel();
    stopLevel = listenUserLevel(user.uid, (lvl) => header.setLevel(lvl));
  });
}

App();
export default App;
