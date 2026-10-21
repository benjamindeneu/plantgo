// src/controllers/IdentifyPanel.controller.js
import { identifyPlant, resizeImage } from "../api/plantgo.js";
import { ResultModal } from "../controllers/ResultModal.controller.js";
import { createIdentifyPanelView } from "../ui/components/IdentifyPanel.view.js";
import { getCurrentUser, getUserTotalPoints } from "../data/user.repo.js";
import { getCurrentPosition } from "../data/geo.service.js";
import { t } from "../language/i18n.js";
import { debugMode } from "../data/debugMode.js";

/**
 * @param {object} [hooks]
 * @param {(files: File[]) => void} [hooks.onFilesChange] fires as photos are
 *   picked or cleared — the map page opens its sheet on the first one.
 * @param {() => void} [hooks.onSubmit] fires when the photos are handed off,
 *   before any network work, so a caller can get its own UI out of the way.
 */
export function IdentifyPanel({ onFilesChange, onSubmit } = {}) {
  const view = createIdentifyPanelView();
  let chosen = [];

  view.onFilesChange((files) => { chosen = files; onFilesChange?.(files); });
  view.onClear(() => { chosen = []; view.setFeedback(""); onFilesChange?.([]); });

  view.onIdentify(async () => {
    if (!chosen.length) return view.setFeedback(t("identify.feedback.addOnePhoto"));

    // Take the photos before anything else touches the selection. The view
    // clears it as soon as this returns, and `onSubmit` lets a caller do the
    // same — a run that read `chosen` after either would find it empty.
    const files = chosen.slice();
    onSubmit?.();
    // When the plant was seen, as far as the app can tell: now. An iNat post
    // made from the result says the same.
    const observedAt = new Date();

    const file = files[0];
    const photoUrls = files.map((f) => URL.createObjectURL(f));

    // preload level/progress
    let currentTotal = 0;
    const user = await getCurrentUser();
    if (user) currentTotal = await getUserTotalPoints(user.uid);

    const modal = ResultModal();
    document.body.appendChild(modal.el);
    await modal.initLoading({ photos: photoUrls, currentTotalPoints: currentTotal });

    const timings = {};
    const t0 = performance.now();

    // geolocate
    let lat, lon, accuracy;
    try {
      const pos = await getCurrentPosition();
      lat = pos.coords.latitude;
      lon = pos.coords.longitude;
      accuracy = pos.coords.accuracy;
    } catch {
      modal.showError(t("identify.feedback.locationDenied"));
      return;
    }
    timings.geolocation = Math.round(performance.now() - t0);

    // identify
    try {
      const lang = document.documentElement.lang || "en";
      const tResize = performance.now();
      const { file: resizedFile, debugInfo: resizeDebugInfo } = await resizeImage(file);
      timings.resize = Math.round(performance.now() - tResize);
      timings.resizeDebugInfo = resizeDebugInfo;

      const tIdentify = performance.now();
      const result = await identifyPlant({ file: resizedFile, lat, lon, model: "best", lang, skipResize: true, debug: debugMode.get() });
      timings.identify = Math.round(performance.now() - tIdentify);

      const bestRaw = result?.identify?.raw || null;
      const plantnetImageCode =
        bestRaw?.images?.[0]?.id || bestRaw?.imageCode || bestRaw?.image?.id || "";

      await modal.showResult({
        ...result,
        lat, lon, accuracy,
        observedAt,
        // The originals, all of them: only the first went to Pl@ntNet, but an
        // iNaturalist post takes every photo.
        files,
        plantnetImageCode,
        photoCount: files.length,
        clientTimings: timings,
      });
    } catch (e) {
      modal.showError(e?.message || t("identify.feedback.failed"));
    }
  });

  const el = view.element;
  el.openPicker = () => view.openPicker();
  el.clearPhotos = () => { chosen = []; view.clear(); view.setFeedback(""); };
  return el;
}
