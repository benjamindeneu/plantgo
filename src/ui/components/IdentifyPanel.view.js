// src/ui/components/IdentifyPanel.view.js
import { t, initI18n, translateDom } from "../../language/i18n.js";
await initI18n();

/**
 * Pure view for the Identify panel.
 */
export function createIdentifyPanelView() {
  const wrap = document.createElement("section");
  //wrap.className = "general-validation card";
  wrap.className = "general-validation";
  wrap.innerHTML = `
    <h1 data-i18n="identify.title">Identify a plant</h1>

    <input id="files" type="file" accept="image/*" capture="environment" multiple hidden>

    <!-- Preview strip becomes the main "add photo" UI -->
    <div class="user-photos center" id="preview"></div>

    <div id="actions" style="display:none; gap:8px; justify-content:center; margin-top:12px">
      <button id="identify" class="primary" type="button" data-i18n="identify.identify">Identify</button>
      <button id="clear" class="secondary" type="button" data-i18n="identify.clear">Clear</button>
    </div>

    <div id="feedback" aria-live="polite" class="validation-feedback"></div>
  `;

  const input = wrap.querySelector("#files");
  const preview = wrap.querySelector("#preview");
  const feedback = wrap.querySelector("#feedback");
  const actions = wrap.querySelector("#actions");
  const btnIdentify = wrap.querySelector("#identify");
  const btnClear = wrap.querySelector("#clear");

  // --- callbacks registered by controller ---
  let filesChangeCb = null;
  let identifyCb = null;
  let clearCb = null;

  // --- internal accumulated state ---
  let selectedFiles = [];

  function setActionsVisible(isVisible) {
    actions.style.display = isVisible ? "flex" : "none";
  }

  function fileKey(file) {
    return `${file.name}|${file.size}|${file.lastModified}`;
  }

  function createAddTile() {
    const label = document.createElement("label");
    label.className = "shot label-file add-shot";
    label.setAttribute("for", "files");
    label.setAttribute("aria-label", t("identify.addPhoto"));

    label.innerHTML = `
      <span class="add-shot-inner" aria-hidden="true">
        <span class="add-shot-icon">
          <svg viewBox="0 0 24 24" width="28" height="28" focusable="false" aria-hidden="true">
            <path fill="currentColor" d="M9 4.5c.4-.7 1.1-1.1 1.9-1.1h2.2c.8 0 1.5.4 1.9 1.1l.7 1.2H18c1.7 0 3 1.3 3 3v8c0 1.7-1.3 3-3 3H6c-1.7 0-3-1.3-3-3v-8c0-1.7 1.3-3 3-3h2.3L9 4.5zm3 12.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z"/>
          </svg>
        </span>
        <span class="add-shot-plus">+</span>
      </span>
    `;

    return label;
  }

  function renderPreview(files = []) {
    preview.innerHTML = "";

    // Render selected images as tiles
    for (const file of files) {
      const tile = document.createElement("div");
      tile.className = "shot";

      const img = document.createElement("img");
      img.alt = t("identify.selectedPhotoAlt");
      img.src = URL.createObjectURL(file);

      tile.appendChild(img);
      preview.appendChild(tile);
    }

    // Render the add-tile as the "next slot"
    preview.appendChild(createAddTile());

    // Actions visible only when >= 1 photo
    setActionsVisible(files.length > 0);
  }

  function refreshI18n() {
    // Update aria-label on the add tile and alt text on images without re-rendering everything
    // Easiest + consistent: just rerender preview from current files
    renderPreview(selectedFiles);
  }

  function clearSelection({ notify = true } = {}) {
    selectedFiles = [];
    input.value = "";
    renderPreview([]);
    if (notify && clearCb) clearCb();
  }

  // Accumulate file selections (avoid duplicates)
  input.addEventListener("change", () => {
    const newFiles = Array.from(input.files || []);
    const existing = new Set(selectedFiles.map(fileKey));

    for (const file of newFiles) {
      const key = fileKey(file);
      if (!existing.has(key)) {
        selectedFiles.push(file);
        existing.add(key);
      }
    }

    renderPreview(selectedFiles);
    if (filesChangeCb) filesChangeCb(selectedFiles);

    // Allow re-selecting the same file later
    input.value = "";
  });

  btnIdentify.addEventListener("click", () => {
    if (!selectedFiles.length) return;

    const filesSnapshot = selectedFiles.slice();
    if (identifyCb) identifyCb(filesSnapshot);

    // Clear after submit
    clearSelection({ notify: false });
  });

  btnClear.addEventListener("click", () => {
    clearSelection({ notify: true });
  });

  translateDom(document);

  // When language changes, update dynamic bits (alt/aria label)
  document.addEventListener("i18n:changed", refreshI18n);

  // Initial render
  renderPreview([]);

  return {
    element: wrap,

    setFeedback(text) {
      feedback.textContent = text ?? "";
    },

    onFilesChange(cb) {
      filesChangeCb = cb;
    },

    onIdentify(cb) {
      identifyCb = cb;
    },

    onClear(cb) {
      clearCb = cb;
    },

    refreshI18n,
  };
}
