// src/pages/mission.app.js — bootstrap for the public mission page (mission.html).
//
// The one page that works without an account: no Firebase, no login redirect,
// no location gate. See MissionShowcase.controller.js.
import { initI18n } from "../language/i18n.js";
import { MissionShowcase } from "../controllers/MissionShowcase.controller.js";

await initI18n();

const missionId = new URLSearchParams(location.search).get("id");
const page = MissionShowcase({ missionId });
document.getElementById("mapRoot").replaceChildren(page.element);

// Leaflet measures its container on init, so size it before starting.
requestAnimationFrame(() => {
  page.invalidate();
  page.start();
});

window.addEventListener("resize", () => page.invalidate());
