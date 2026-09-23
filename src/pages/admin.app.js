// src/pages/admin.app.js
import { initI18n } from "../language/i18n.js";
import { applyEventTheme } from "../data/events.js";
import { Header } from "../controllers/Header.controller.js";
import { AdminController } from "../controllers/Admin.controller.js";
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
    menuVariant: "herbarium", // shows "🏠 Main" as primary nav
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

  const adminMount = document.getElementById("adminRoot");
  AdminController(adminMount);

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      stopLevel();
      return; // AdminController handles redirect
    }

    header.setUser(user);

    stopLevel();
    stopLevel = listenUserLevel(user.uid, (lvl) => header.setLevel(lvl));
  });
}

App();
export default App;
