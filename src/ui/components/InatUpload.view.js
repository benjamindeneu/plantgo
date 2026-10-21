// src/ui/components/InatUpload.view.js
import { t, translateDom } from "../../language/i18n.js";
import { INAT_MARK } from "./organIcons.js";

const SEARCH_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M10 3a7 7 0 0 1 5.6 11.2l4.6 4.6-1.4 1.4-4.6-4.6A7 7 0 1 1 10 3zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"/></svg>`;
const CLEAR_ICON = `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7l-1.4-1.4L9.2 12 2.9 5.7l1.4-1.4 6.3 6.3 6.3-6.3z"/></svg>`;

// The same imagery the map page is drawn on, so the place looks familiar.
const TILE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const START_ZOOM = 17;

/** Metres one screen pixel covers at this latitude and zoom (Web Mercator). */
function metresPerPixel(lat, zoom) {
  return (40075016.686 * Math.cos((lat * Math.PI) / 180)) / 2 ** (zoom + 8);
}

/**
 * How sure a pin dropped by hand is: about a fingertip (15 px) at the zoom it
 * was dropped at, never under 5 m. A GPS fix keeps its own figure.
 */
function placedAccuracy(lat, zoom) {
  return Math.max(5, Math.round(15 * metresPerPixel(lat, zoom)));
}

/**
 * The popup that posts an observation to iNaturalist: the photos, the species
 * (Pl@ntNet's suggestion, or the player's pick from iNat's catalogue), the
 * spot on a map, and the few fields iNat asks about. The controller owns the
 * state and the calls; this only draws it and reports what the player does.
 */
export function createInatUploadView({ photos = [] } = {}) {
  const overlay = document.createElement("div");
  overlay.className = "modal show mp-inat";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.innerHTML = `
    <div class="modal-content mp-inat__card">
      <div class="mp-inat__head">
        <h2 class="mp-inat__title">${INAT_MARK}<span data-i18n="inat.title"></span></h2>
        <button class="close mp-inat__close" type="button" data-i18n-title="common.close">×</button>
      </div>

      <section class="mp-inat__gate" hidden>
        <p class="mp-inat__lead" data-i18n="inat.gate.lead"></p>
      </section>

      <div class="mp-inat__form">
        <p class="mp-inat__account"></p>
        <div class="user-photos center mp-inat__photos"></div>

        <section class="mp-inat__section">
          <h3 class="mp-inat__label" data-i18n="inat.species.label"></h3>
          <div class="mp-inat__species">
            <span class="mp-row__thumb"><span class="mp-row__leaf" aria-hidden="true">🌿</span></span>
            <span class="mp-inat__species-text">
              <span class="mp-inat__species-name"></span>
              <span class="mp-inat__species-sci"></span>
              <span class="mp-inat__species-note"></span>
            </span>
            <button class="mp-inat__change" type="button" data-i18n="inat.species.change"></button>
          </div>
          <div class="mp-inat__search" hidden>
            <label class="mp-search">
              <span class="mp-search__icon">${SEARCH_ICON}</span>
              <input class="mp-search__input" type="search" autocomplete="off" autocorrect="off" spellcheck="false" data-i18n-placeholder="inat.search.placeholder">
              <button class="mp-search__clear" type="button" hidden>${CLEAR_ICON}</button>
            </label>
            <p class="mp-inat__search-status" role="status"></p>
            <div class="mp-list mp-inat__results"></div>
          </div>
          <button class="mp-inat__textbtn mp-inat__species-reset" type="button" data-i18n="inat.species.reset" hidden></button>
        </section>

        <section class="mp-inat__section">
          <h3 class="mp-inat__label" data-i18n="inat.location.label"></h3>
          <div class="mp-inat__map"></div>
          <div class="mp-inat__loc-line">
            <span class="mp-inat__coords"></span>
            <button class="mp-inat__textbtn mp-inat__loc-reset" type="button" data-i18n="inat.location.reset" hidden></button>
          </div>
          <p class="mp-inat__hint" data-i18n="inat.location.hint"></p>
        </section>

        <section class="mp-inat__section">
          <label class="settings-toggle mp-inat__captive">
            <input type="checkbox">
            <span class="mp-inat__captive-text">
              <span data-i18n="inat.captive.label"></span>
              <small data-i18n="inat.captive.hint"></small>
            </span>
          </label>
          <label class="mp-inat__field">
            <span class="mp-inat__label" data-i18n="inat.geoprivacy.label"></span>
            <select class="input mp-inat__geoprivacy">
              <option value="open" data-i18n="inat.geoprivacy.open"></option>
              <option value="obscured" data-i18n="inat.geoprivacy.obscured"></option>
              <option value="private" data-i18n="inat.geoprivacy.private"></option>
            </select>
          </label>
          <label class="mp-inat__field">
            <span class="mp-inat__label" data-i18n="inat.notes.label"></span>
            <textarea class="input mp-inat__notes" rows="3"></textarea>
            <span class="mp-inat__hint" data-i18n="inat.notes.hint"></span>
          </label>
        </section>
      </div>

      <div class="mp-inat__done" hidden>
        <p class="mp-inat__done-text" data-i18n="inat.done.text"></p>
        <a class="mp-detail__link mp-inat__done-link" target="_blank" rel="noopener noreferrer">${INAT_MARK}<span data-i18n="inat.button.view"></span></a>
      </div>

      <p class="mp-inat__status" role="status" hidden></p>

      <div class="result-actions">
        <button class="secondary" type="button" data-act="cancel" data-i18n="inat.cancel"></button>
        <button class="primary" type="button" data-act="submit" data-i18n="inat.submit"></button>
      </div>
    </div>
  `;

  const qs = (sel) => overlay.querySelector(sel);
  translateDom(overlay);
  qs(".mp-inat__close").setAttribute("aria-label", t("common.close"));

  qs(".mp-inat__photos").innerHTML = photos
    .map((url) => `<div class="shot"><img src="${url}" alt="" loading="lazy"/></div>`)
    .join("");

  document.body.style.overflow = "hidden";

  // --- closing -------------------------------------------------------------
  let onClose = null;
  let map = null;
  function close() {
    document.removeEventListener("keydown", onKey);
    map?.remove();
    overlay.remove();
    // Restore scroll only if no other modals remain open
    if (!document.querySelector(".modal.show")) document.body.style.overflow = "";
    onClose?.();
  }
  function onKey(e) { if (e.key === "Escape") close(); }
  document.addEventListener("keydown", onKey);
  qs(".mp-inat__close").addEventListener("click", close);
  qs('[data-act="cancel"]').addEventListener("click", close);

  // --- species search --------------------------------------------------------
  const search = qs(".mp-inat__search");
  const searchInput = qs(".mp-search__input");
  const searchClear = qs(".mp-search__clear");
  const results = qs(".mp-inat__results");
  let onSearch = null;
  let onPick = null;

  searchInput.addEventListener("input", () => {
    searchClear.hidden = !searchInput.value;
    onSearch?.(searchInput.value);
  });
  searchClear.addEventListener("click", (e) => {
    e.preventDefault();
    searchInput.value = "";
    searchClear.hidden = true;
    onSearch?.("");
    searchInput.focus();
  });

  function fillThumb(thumb, url) {
    if (!url) return;
    const img = new Image();
    img.alt = "";
    img.decoding = "async";
    img.addEventListener("load", () => thumb.classList.add("has-photo"), { once: true });
    img.src = url;
    thumb.appendChild(img);
  }

  function resultRow(tx) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "mp-row mp-inat__result";
    b.innerHTML = `
      <span class="mp-row__thumb"><span class="mp-row__leaf" aria-hidden="true">🌿</span></span>
      <span class="mp-row__text">
        <span class="mp-row__head"><span class="mp-row__name"></span></span>
        <span class="mp-row__sci"></span>
      </span>`;
    b.querySelector(".mp-row__name").textContent = tx.common_name || tx.name;
    b.querySelector(".mp-row__sci").textContent = tx.common_name ? tx.name : "";
    fillThumb(b.querySelector(".mp-row__thumb"), tx.photo);
    b.addEventListener("click", () => onPick?.(tx));
    return b;
  }

  // --- the map ---------------------------------------------------------------
  const mapEl = qs(".mp-inat__map");
  let marker = null;
  let circle = null;
  let origin = null;

  return {
    el: overlay,
    close,
    onClose(cb) { onClose = cb; },

    // --- token gate ---
    /** Swap the form for the token gate, holding `formEl` (the shared token form). */
    showGate(formEl) {
      const gate = qs(".mp-inat__gate");
      if (formEl && formEl.parentNode !== gate) gate.appendChild(formEl);
      gate.hidden = false;
      qs(".mp-inat__form").hidden = true;
    },
    hideGate() {
      qs(".mp-inat__gate").hidden = true;
      qs(".mp-inat__form").hidden = false;
      // Drawn while hidden, the map had no size: give it one and re-centre.
      if (map && marker) {
        map.invalidateSize();
        map.setView(marker.getLatLng(), map.getZoom());
      }
    },
    setAccount(text) { qs(".mp-inat__account").textContent = text || ""; },

    // --- species ---
    /** noteKind: "" | "warn" | "corrected" */
    setSpecies({ name, sci = "", photo = null, note = "", noteKind = "" }) {
      qs(".mp-inat__species-name").textContent = name || "";
      const sciEl = qs(".mp-inat__species-sci");
      sciEl.textContent = sci;
      sciEl.hidden = !sci;
      const noteEl = qs(".mp-inat__species-note");
      noteEl.textContent = note;
      noteEl.dataset.kind = noteKind;
      const thumb = qs(".mp-inat__species .mp-row__thumb");
      thumb.classList.remove("has-photo");
      thumb.querySelector("img")?.remove();
      fillThumb(thumb, photo);
    },
    showSpeciesReset(show) { qs(".mp-inat__species-reset").hidden = !show; },
    openSearch() {
      search.hidden = false;
      qs(".mp-inat__change").hidden = true;
      searchInput.focus();
    },
    closeSearch() {
      search.hidden = true;
      qs(".mp-inat__change").hidden = false;
      searchInput.value = "";
      searchClear.hidden = true;
      results.replaceChildren();
      qs(".mp-inat__search-status").textContent = "";
    },
    setSearchStatus(text) { qs(".mp-inat__search-status").textContent = text || ""; },
    setSearchResults(taxa) { results.replaceChildren(...taxa.map(resultRow)); },
    onChangeSpecies(cb) { qs(".mp-inat__change").addEventListener("click", cb); },
    onResetSpecies(cb) { qs(".mp-inat__species-reset").addEventListener("click", cb); },
    onSearchInput(cb) { onSearch = cb; },
    onPick(cb) { onPick = cb; },

    // --- location ---
    /**
     * Draw the map at the GPS fix. `onMove({ lat, lon, accuracy, moved })`
     * hears every change, including the reset back to the fix. If Leaflet
     * cannot load, the section keeps the coordinates and loses the map.
     */
    async mountMap({ lat, lon, accuracy }, onMove) {
      origin = { lat, lon, accuracy };
      const setCoords = (p) => {
        qs(".mp-inat__coords").textContent = `${p.lat.toFixed(5)}, ${p.lon.toFixed(5)} · ±${Math.round(p.accuracy ?? 0)} m`;
        qs(".mp-inat__loc-reset").hidden = !p.moved;
      };
      setCoords({ ...origin, moved: false });

      let L;
      try {
        ({ default: L } = await import("https://esm.sh/leaflet@1.9.4"));
      } catch (e) {
        console.error("[InatUpload] Leaflet failed to load:", e);
        mapEl.hidden = true;
        qs(".mp-inat__hint").hidden = true;
        return;
      }
      if (!overlay.isConnected) return;

      map = L.map(mapEl, {
        zoomControl: true,
        attributionControl: false,
        keyboard: false,
      }).setView([lat, lon], START_ZOOM);
      L.tileLayer(TILE_URL, { maxZoom: 19 }).addTo(map);

      circle = L.circle([lat, lon], {
        radius: accuracy || 0,
        color: "#ffffff",
        weight: 1.5,
        fillColor: "#ffffff",
        fillOpacity: 0.18,
        interactive: false,
      }).addTo(map);
      marker = L.marker([lat, lon], {
        draggable: true,
        autoPan: true,
        icon: L.divIcon({ className: "", html: `<div class="mp-inat-pin"></div>`, iconSize: [26, 26], iconAnchor: [13, 31] }),
      }).addTo(map);

      const place = (latlng) => {
        const p = { lat: latlng.lat, lon: latlng.lng, accuracy: placedAccuracy(latlng.lat, map.getZoom()), moved: true };
        marker.setLatLng(latlng);
        circle.setLatLng(latlng).setRadius(p.accuracy);
        setCoords(p);
        onMove?.(p);
      };
      marker.on("dragend", () => place(marker.getLatLng()));
      map.on("click", (e) => place(e.latlng));

      qs(".mp-inat__loc-reset").addEventListener("click", () => {
        marker.setLatLng([origin.lat, origin.lon]);
        circle.setLatLng([origin.lat, origin.lon]).setRadius(origin.accuracy || 0);
        map.setView([origin.lat, origin.lon], Math.max(map.getZoom(), START_ZOOM));
        const p = { ...origin, moved: false };
        setCoords(p);
        onMove?.(p);
      });

      // On touch, one finger scrolls the popup and two pan the map; the pin
      // keeps its own drag. Mouse users get the usual drag.
      map.dragging.disable();
      mapEl.addEventListener("touchstart", (e) => {
        if (e.touches.length >= 2) map.dragging.enable();
        else map.dragging.disable();
      }, { passive: true });
      mapEl.addEventListener("touchend", () => map.dragging.disable(), { passive: true });
      mapEl.addEventListener("mousedown", () => map.dragging.enable(), { passive: true });
      mapEl.addEventListener("mouseup", () => map.dragging.disable(), { passive: true });

      // The popup was laid out before the map existed.
      requestAnimationFrame(() => map?.invalidateSize());
    },

    // --- fields ---
    getFields() {
      return {
        captive: qs(".mp-inat__captive input").checked,
        geoprivacy: qs(".mp-inat__geoprivacy").value,
        notes: qs(".mp-inat__notes").value.trim(),
      };
    },
    setGeoprivacy(value) {
      const select = qs(".mp-inat__geoprivacy");
      if ([...select.options].some((o) => o.value === value)) select.value = value;
    },
    onGeoprivacyChange(cb) {
      const select = qs(".mp-inat__geoprivacy");
      select.addEventListener("change", () => cb(select.value));
    },
    /** Once the observation exists, what it says can no longer be changed here. */
    lockForm() {
      qs(".mp-inat__form").classList.add("is-locked");
      qs(".mp-inat__form").querySelectorAll("input, select, textarea, button").forEach((c) => { c.disabled = true; });
      marker?.dragging?.disable();
      map?.off("click");
    },

    // --- progress ---
    /** kind: "" | "error" */
    setStatus(text, kind = "") {
      const el = qs(".mp-inat__status");
      el.textContent = text || "";
      el.dataset.kind = kind;
      el.hidden = !text;
    },
    setBusy(busy) {
      if (busy) qs('[data-act="submit"]').disabled = true;
      overlay.classList.toggle("is-busy", busy);
    },
    setSubmitLabel(key) {
      const btn = qs('[data-act="submit"]');
      btn.dataset.i18n = key;
      btn.textContent = t(key);
    },
    setSubmitEnabled(enabled) { qs('[data-act="submit"]').disabled = !enabled; },
    showDone(url) {
      qs(".mp-inat__form").hidden = true;
      qs(".mp-inat__gate").hidden = true;
      qs(".mp-inat__done").hidden = false;
      qs(".mp-inat__done-link").href = url;
      qs('[data-act="cancel"]').hidden = true;
    },
    onSubmit(cb) { qs('[data-act="submit"]').addEventListener("click", cb); },
  };
}
