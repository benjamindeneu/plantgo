// src/pages/species.app.js — bootstrap for the species page (species.html).
import { initI18n } from "../language/i18n.js";
import { applyEventTheme } from "../data/events.js";
import { Header } from "../controllers/Header.controller.js";
import { SpeciesPage } from "../controllers/SpeciesPage.controller.js";
import { LocationGate } from "../ui/components/LocationGate.js";
import { listenUserLevel } from "../user/level.js";

import { auth } from "../../firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";

await initI18n();
// Dress the page for the running event, if any.
applyEventTheme();

function App() {
  // The list is the species of the country the player is in, so it starts
  // from a location like the front page does.
  LocationGate();

  let stopLevel = () => {};
  let page = null;
  let booted = false;

  const headerMount = document.getElementById("appHeader");
  const header = Header({
    user: null,
    level: 1,
    current: "species",
    onLogout: async () => {
      try {
        stopLevel();
        page?.stop();
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

    // `onAuthStateChanged` fires again on token refresh; one map is enough.
    if (booted) return;
    booted = true;

    page = SpeciesPage();
    mount.replaceChildren(page.element);
    // Leaflet measures its container on init, so size it before starting.
    requestAnimationFrame(() => {
      page.invalidate();
      page.start();
    });
  });

  window.addEventListener("resize", () => page?.invalidate());
}

App();
export default App;
