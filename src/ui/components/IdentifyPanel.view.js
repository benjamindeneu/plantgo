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
      <button id="identifierBtn" class="secondary btn-icon identifier-btn" type="button"
              aria-expanded="false" aria-controls="identifierPanel" data-i18n-title="identify.identifier.button">
        <svg viewBox="0 0 24 24" width="20" height="20" focusable="false" aria-hidden="true">
          <path fill="currentColor" d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2z"/>
        </svg>
      </button>
    </div>

    <!-- Which identifier names the plant: opened from the gear, under the buttons -->
    <div id="identifierPanel" class="identifier-panel" hidden>
      <p class="identifier-panel__title" id="identifierTitle" data-i18n="identify.identifier.title">Identifier</p>
      <div class="identifier-panel__list" role="radiogroup" aria-labelledby="identifierTitle"></div>
    </div>

    <div id="feedback" aria-live="polite" class="validation-feedback"></div>
  `;

  const input = wrap.querySelector("#files");
  const preview = wrap.querySelector("#preview");
  const feedback = wrap.querySelector("#feedback");
  const actions = wrap.querySelector("#actions");
  const btnIdentify = wrap.querySelector("#identify");
  const btnClear = wrap.querySelector("#clear");
  const btnIdentifier = wrap.querySelector("#identifierBtn");
  const identifierPanel = wrap.querySelector("#identifierPanel");
  const identifierList = identifierPanel.querySelector(".identifier-panel__list");

  // --- callbacks registered by controller ---
  let filesChangeCb = null;
  let identifyCb = null;
  let clearCb = null;
  let identifierOpenCb = null;
  let identifierChangeCb = null;

  // --- internal accumulated state ---
  let selectedFiles = [];
  // What the identifier list was last filled with, so a language change can redraw it
  let identifiers = null;

  function setActionsVisible(isVisible) {
    actions.style.display = isVisible ? "flex" : "none";
    if (!isVisible) setIdentifierPanelOpen(false);
  }

  function setIdentifierPanelOpen(open) {
    identifierPanel.hidden = !open;
    btnIdentifier.setAttribute("aria-expanded", String(open));
  }

  function identifierOption(value, name, hint, checked) {
    const label = document.createElement("label");
    label.className = "identifier-option";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "identifier";
    input.value = value;
    input.checked = checked;
    const nameEl = document.createElement("span");
    nameEl.className = "identifier-option__name";
    nameEl.textContent = name;
    label.append(input, nameEl);
    if (hint) {
      const hintEl = document.createElement("span");
      hintEl.className = "identifier-option__hint";
      hintEl.textContent = hint;
      label.appendChild(hintEl);
    }
    return label;
  }

  /**
   * Auto first, naming what it stands for here, then every identifier that
   * runs here. A pick that does not run here shows as Auto — which is what
   * the server will do with it — without being forgotten.
   */
  function renderIdentifiers() {
    const { models = [], defaultModel = null, selected = "auto" } = identifiers || {};
    const defaultName = models.find((m) => m.id === defaultModel)?.name ?? null;
    const shown = models.some((m) => m.id === selected) ? selected : "auto";

    identifierList.replaceChildren(identifierOption(
      "auto",
      defaultName ? `${t("identify.identifier.auto")} · ${defaultName}` : t("identify.identifier.auto"),
      t("identify.identifier.autoHint"),
      shown === "auto",
    ));
    for (const m of models) identifierList.appendChild(identifierOption(m.id, m.name, "", shown === m.id));
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

    if (files.length === 0) {
      // Empty state: wrap the add-tile with curvy arrows so there's an immediate visual CTA
      const wrap = document.createElement("div");
      wrap.className = "identify-cta-wrap";

      const arrowLeft = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      arrowLeft.setAttribute("class", "cta-arrow cta-arrow--left");
      arrowLeft.setAttribute("viewBox", "0 0 56 54");
      arrowLeft.setAttribute("width", "44");
      arrowLeft.setAttribute("height", "44");
      arrowLeft.setAttribute("aria-hidden", "true");
      arrowLeft.innerHTML = `<path d="M 10 6 C 2 24, 16 46, 46 42"/><path d="M 46 42 L 34 33 M 46 42 L 37 52"/>`;

      const arrowRight = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      arrowRight.setAttribute("class", "cta-arrow cta-arrow--right");
      arrowRight.setAttribute("viewBox", "0 0 56 54");
      arrowRight.setAttribute("width", "44");
      arrowRight.setAttribute("height", "44");
      arrowRight.setAttribute("aria-hidden", "true");
      arrowRight.innerHTML = `<path d="M 46 6 C 54 24, 40 46, 10 42"/><path d="M 10 42 L 22 33 M 10 42 L 19 52"/>`;

      wrap.appendChild(arrowLeft);
      wrap.appendChild(createAddTile());
      wrap.appendChild(arrowRight);
      preview.appendChild(wrap);
    } else {
      // Render the add-tile as the "next slot"
      preview.appendChild(createAddTile());
    }

    // Actions visible only when >= 1 photo
    setActionsVisible(files.length > 0);
  }

  function refreshI18n() {
    // Update aria-label on the add tile and alt text on images without re-rendering everything
    // Easiest + consistent: just rerender preview from current files
    renderPreview(selectedFiles);
    btnIdentifier.setAttribute("aria-label", t("identify.identifier.button"));
    if (identifiers) renderIdentifiers();
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

  btnIdentifier.addEventListener("click", () => {
    const open = identifierPanel.hidden;
    setIdentifierPanelOpen(open);
    if (open && identifierOpenCb) identifierOpenCb();
  });

  identifierList.addEventListener("change", (e) => {
    if (e.target?.name !== "identifier") return;
    if (identifiers) identifiers.selected = e.target.value;
    if (identifierChangeCb) identifierChangeCb(e.target.value);
  });

  translateDom(document);
  // The panel is not in the document yet, so the line above does not reach it
  translateDom(wrap);
  btnIdentifier.setAttribute("aria-label", t("identify.identifier.button"));

  // When language changes, update dynamic bits (alt/aria label)
  document.addEventListener("i18n:changed", refreshI18n);

  // Initial render
  renderPreview([]);

  return {
    element: wrap,

    /**
     * Open the camera without the user having to hit the tile.
     *
     * `capture="environment"` on the input is what makes a phone go straight
     * to the rear camera, so triggering the same input from elsewhere gets the
     * same behaviour — no second code path for taking a photo.
     */
    openPicker() {
      input.click();
    },

    /** Drop the pending photos — for a caller that dismissed its own UI. */
    clear({ notify = false } = {}) {
      clearSelection({ notify });
    },

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

    /** Fires each time the gear opens the identifier panel. */
    onIdentifierOpen(cb) {
      identifierOpenCb = cb;
    },

    /** Fires with the picked identifier's id, or "auto". */
    onIdentifierChange(cb) {
      identifierChangeCb = cb;
    },

    /** While the identifiers for here are being fetched. */
    setIdentifiersLoading() {
      identifiers = null;
      const p = document.createElement("p");
      p.className = "identifier-panel__loading";
      p.textContent = t("identify.identifier.loading");
      identifierList.replaceChildren(p);
    },

    /**
     * @param {object} opts
     * @param {{id: string, name: string}[]} [opts.models] the identifiers that run here
     * @param {string|null} [opts.defaultModel] what Auto stands for here
     * @param {string} [opts.selected] the player's pick, or "auto"
     */
    setIdentifiers({ models = [], defaultModel = null, selected = "auto" } = {}) {
      identifiers = { models, defaultModel, selected };
      renderIdentifiers();
    },

    refreshI18n,
  };
}
