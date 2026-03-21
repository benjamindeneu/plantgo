// src/controllers/IdentifyPanel.controller.js
import { identifyPlant } from "../api/plantgo.js";
import { ResultModal } from "../controllers/ResultModal.controller.js";
import { createIdentifyPanelView } from "../ui/components/IdentifyPanel.view.js";
import { getCurrentUser, getUserTotalPoints } from "../data/user.repo.js";
import { getCurrentPosition } from "../data/geo.service.js";
import { t } from "../language/i18n.js";

export function IdentifyPanel() {
  const view = createIdentifyPanelView();
  let chosen = [];

  view.onFilesChange((files) => { chosen = files; });
  view.onClear(() => { chosen = []; view.setFeedback(""); });

  view.onIdentify(async () => {
    if (!chosen.length) return view.setFeedback(t("identify.feedback.addOnePhoto"));

    const file = chosen[0];
    const photoUrls = chosen.map((f) => URL.createObjectURL(f));

    // preload level/progress
    let currentTotal = 0;
    const user = await getCurrentUser();
    if (user) currentTotal = await getUserTotalPoints(user.uid);

    const modal = ResultModal();
    document.body.appendChild(modal.el);
    await modal.initLoading({ photos: photoUrls, currentTotalPoints: currentTotal });

    // geolocate
    let lat, lon;
    try {
      const pos = await getCurrentPosition();
      lat = pos.coords.latitude;
      lon = pos.coords.longitude;
    } catch {
      modal.showError(t("identify.feedback.locationDenied"));
      return;
    }

    // identify
    try {
      const lang = document.documentElement.lang || "en";
      const result = await identifyPlant({ file, lat, lon, model: "best", lang });

      const bestRaw = result?.identify?.raw || null;
      const plantnetImageCode =
        bestRaw?.images?.[0]?.id || bestRaw?.imageCode || bestRaw?.image?.id || "";

      await modal.showResult({
        ...result,
        lat, lon,
        plantnetImageCode,
        photoCount: chosen.length,
      });
    } catch (e) {
      modal.showError(e?.message || t("identify.feedback.failed"));
    }
  });

  return view.element;
}
