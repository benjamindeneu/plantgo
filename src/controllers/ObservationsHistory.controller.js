// src/controllers/ObservationsHistory.controller.js
import { createObservationsHistoryView } from "../ui/components/ObservationsHistory.view.js";
import { loadObservationsPage } from "../data/observations.repo.js";
import { auth } from "../../firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";
import { t } from "../language/i18n.js";

export function ObservationsHistoryPanel() {
  const view = createObservationsHistoryView();

  let lastDoc  = null;
  let hasMore  = true;
  let loading  = false;
  let observer = null;

  async function loadNextPage(uid) {
    if (loading || !hasMore) return;
    loading = true;
    view.setLoadingMore(true);

    try {
      const result = await loadObservationsPage(uid, { after: lastDoc });
      lastDoc = result.lastDoc;
      hasMore = result.hasMore;

      if (lastDoc === null && result.entries.length === 0) {
        // first page empty
        view.renderEntries([]);
      } else if (!lastDoc || result.entries.length === 0) {
        // no more pages
      } else {
        view.appendEntries(result.entries);
      }

      if (!hasMore && observer) {
        observer.disconnect();
        observer = null;
      }
    } catch (e) {
      console.error("[ObservationsHistory] load error:", e);
      view.setStatus(t("observations.status.loadFailed"));
    } finally {
      loading = false;
      view.setLoadingMore(false);
    }
  }

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      view.setStatus(t("herbarium.status.loginRequired"));
      view.clearEntries();
      if (observer) { observer.disconnect(); observer = null; }
      return;
    }

    // Reset state on (re-)login
    lastDoc = null;
    hasMore = true;
    loading = false;
    view.clearEntries();

    try {
      view.setStatus(t("observations.status.loading"));
      const result = await loadObservationsPage(user.uid, { after: null });
      lastDoc = result.lastDoc;
      hasMore = result.hasMore;
      view.renderEntries(result.entries);
      view.setStatus("");
    } catch (e) {
      console.error("[ObservationsHistory] initial load error:", e);
      view.setStatus(t("observations.status.loadFailed"));
      return;
    }

    if (!hasMore) return;

    // Watch the sentinel to trigger subsequent pages
    observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) loadNextPage(user.uid);
    }, { rootMargin: "200px" });

    observer.observe(view.sentinel);
  });

  return view.element;
}
