// src/controllers/Herbarium.controller.js
import { createHerbariumView } from "../ui/components/Herbarium.view.js";
import { openSpeciesSheet } from "../ui/components/SpeciesSheet.js";
import { loadDiscoveries, resolveDiscoveryGbifId } from "../data/discoveries.repo.js";
import { auth } from "../../firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";
import { t } from "../language/i18n.js";

export function HerbariumPanel() {
  const view = createHerbariumView({
    // The same screen the map opens for a pin: photo, write-up, trivia,
    // links. The write-up and trivia are fetched by GBIF id, so that is
    // looked up first — instant for a recent discovery, one read for an
    // old one — and the sheet opens with it.
    onOpen: async (entry) => {
      const uid = auth.currentUser?.uid;
      const gbif_id = uid ? await resolveDiscoveryGbifId(uid, entry) : (entry.gbif_id ?? null);
      openSpeciesSheet({ name: entry.name, vernacular_name: entry.vernacularName || undefined, gbif_id });
    },
  });

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      view.setStatus(t("herbarium.status.loginRequired"));
      view.clearEntries();
      return;
    }

    try {
      view.setStatus(t("herbarium.status.loading"));
      const entries = await loadDiscoveries(user.uid);
      view.renderEntries(entries);
      view.setStatus("");
    } catch (e) {
      console.error("[Herbarium] load error:", e);
      view.setStatus(t("herbarium.status.loadFailed"));
      view.clearEntries();
    }
  });

  return view.element;
}
