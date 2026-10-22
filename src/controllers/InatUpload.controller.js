// src/controllers/InatUpload.controller.js
import { createInatUploadView } from "../ui/components/InatUpload.view.js";
import { InatTokenForm, describeInatToken } from "./InatTokenForm.controller.js";
import { inatToken } from "../data/inatToken.js";
import {
  inatAutocomplete,
  inatCreateObservation,
  inatUploadPhoto,
  inatFindByUuid,
  inatObservationUrl,
} from "../api/inaturalist.js";
import { canonicalName, inatTaxonForSuggestion, gbifKeyForInatTaxon, slimTaxon } from "../data/inatTaxa.service.js";
import { PLANTAE } from "../api/inaturalist.js";
import { setObservationInat, setObservationInatPhotos, addUnscoredObservation, LEGACY_IDENTIFIER } from "../data/observations.js";
import { resizeImage } from "../api/plantgo.js";
import { t } from "../language/i18n.js";

const GEOPRIVACY_KEY = "plantgo_inat_geoprivacy";
// iNat keeps photos up to 2048 px on the long side; anything bigger is only
// a slower upload.
const PHOTO_MAX_DIM = 2048;
const SEARCH_DEBOUNCE_MS = 300;

/** "2026-10-21T14:03:05+02:00": the moment, with the offset iNat needs to place it in the day. */
function isoWithOffset(d) {
  const pad = (n) => String(Math.trunc(Math.abs(n))).padStart(2, "0");
  const off = -d.getTimezoneOffset();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    + `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    + `${off >= 0 ? "+" : "-"}${pad(off / 60)}:${pad(off % 60)}`;
}

function newUuid() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function readGeoprivacy() {
  try { return localStorage.getItem(GEOPRIVACY_KEY) || "open"; } catch { return "open"; }
}
function writeGeoprivacy(value) {
  try { localStorage.setItem(GEOPRIVACY_KEY, value); } catch {}
}

/**
 * Post one observation to iNaturalist from the result modal.
 *
 * The iNat observation is created first and its link written to Firestore
 * straight away — before any photo goes up — so a failure after that point
 * can only ever cost photos, never make a second observation. Photos that did
 * not make it are retried on their own.
 *
 * @param {object} ctx
 * @param {string} ctx.userId
 * @param {string|null} ctx.observationId the PlantGo observation to link, or
 *   null for a low-confidence result, which gets an unscored one on upload.
 * @param {File[]} ctx.files the player's original photos
 * @param {object} ctx.identify identify's answer: name, vernacularName, gbif_id, score, identifier
 * @param {boolean} [ctx.lowConfidence] the score is under the identifier's
 *   min_score: the observation goes up unidentified unless the player takes
 *   the suggestion.
 * @param {(url: string) => void} [ctx.onUploaded] fires once the observation exists
 */
export function openInatUpload({
  userId,
  observationId,
  files = [],
  identify = {},
  lowConfidence = false,
  lat,
  lon,
  accuracy = null,
  observedAt = null,
  onUploaded,
}) {
  const locale = document.documentElement.lang || "en";
  const photoUrls = files.map((f) => URL.createObjectURL(f));
  const view = createInatUploadView({ photos: photoUrls });
  document.body.appendChild(view.el);

  const score = Number(identify?.score ?? 0);
  const pct = Math.round(score * 100);
  const suggestedName = canonicalName(identify?.name);
  // Whose suggestion it is; an answer without one came from before identifiers were named
  const identifier = identify?.identifier || LEGACY_IDENTIFIER;
  // A suggestion under the identifier's threshold is set aside: the player
  // can still take it, but by default nothing is claimed for them.
  const canWithhold = lowConfidence && !!suggestedName;

  const state = {
    suggested: undefined, // iNat taxon for the identifier's name: undefined while looking, null if none
    picked: null,         // the player's own pick, when it differs from the suggestion
    confirmed: false,     // the player vouched for the identifier's suggestion themselves
    unknown: canWithhold, // sent with no identification, the low-confidence suggestion set aside
    gbifKey: null,        // Promise of the GBIF id for `picked`
    position: { lat, lon, accuracy, moved: false },
    uuid: newUuid(),
    created: null,        // { id, uuid, url } once the observation exists on iNat
    photosDone: 0,
    busy: false,
    done: false,
    closed: false,
  };

  view.onClose(() => {
    state.closed = true;
    clearTimeout(searchTimer);
    searchCtrl?.abort();
    photoUrls.forEach((u) => URL.revokeObjectURL(u));
  });

  // --- token gate ------------------------------------------------------------
  const tokenForm = InatTokenForm({ onChange: () => refreshGate() });

  function refreshGate() {
    const valid = inatToken.status().state === "valid";
    if (valid && !state.done) {
      view.hideGate();
      view.setAccount(describeInatToken().text);
    } else if (!valid && !state.done) {
      tokenForm.refresh();
      view.showGate(tokenForm.element);
    }
    view.setSubmitEnabled(valid && !state.busy);
  }

  // --- species ---------------------------------------------------------------
  // Unsure of the species is said on iNat by naming less: a genus, a family,
  // or just "Plant" (Plantae), which puts the observation in front of plant
  // identifiers. This is that last choice, offered first in every search.
  const PLANTS = { id: PLANTAE, name: "Plantae", rank: "kingdom", rank_level: 70, common_name: t("inat.species.plant"), photo: null };
  const unsureItem = { name: t("inat.search.unsure"), sci: "Plantae", photo: null, taxon: PLANTS };

  const isGroup = (tx) => ["genus", "family"].includes(tx.rank);
  /** The Latin line: a genus or family says which it is, so it is not read as a species. */
  const sciOf = (tx) => (isGroup(tx) ? `${t(`inat.rank.${tx.rank}`)} ${tx.name}` : tx.name);
  /** A taxon as a row or card: common name first, the Latin under it when it adds something. */
  const itemOf = (tx) => ({ name: tx.common_name || tx.name, sci: tx.common_name || isGroup(tx) ? sciOf(tx) : "", photo: tx.photo, taxon: tx });

  /**
   * Where the identification came from, which is what iNat's computer-vision
   * flag is set from: an untouched suggestion is the identifier's ("auto"),
   * one the player confirmed or replaced is theirs. Uploads from before
   * identifiers were named stored "plantnet" for "auto".
   */
  function idSource() {
    if (state.picked) return "corrected";
    if (!suggestedName || state.unknown) return "none";
    return state.confirmed ? "confirmed" : "auto";
  }

  /**
   * The card says whose identification is going to iNat: the identifier's
   * automatic suggestion, or the player's own once they confirm or replace it.
   * The line under it says how it will be sent, and how to switch back.
   */
  function renderSpecies() {
    const tx = state.picked || state.suggested;
    const onSuggestion = !state.picked && !state.unknown && !!suggestedName;
    const origin = state.picked || state.confirmed
      ? { kind: "human", text: t("inat.species.originHuman") }
      : onSuggestion ? { kind: "auto", text: t("inat.species.originAuto", { pct, identifier: identifier.name }) } : null;
    const plain = { name: identify?.vernacularName || suggestedName, sci: identify?.vernacularName ? suggestedName : "" };

    if (state.picked) {
      const item = itemOf(tx);
      const note = suggestedName ? t("inat.species.plantnetWas", { name: suggestedName, identifier: identifier.name }) : "";
      view.setSpecies({ name: item.name, sci: item.sci, photo: tx.photo, origin, note });
    } else if (state.unknown) {
      const note = t("inat.species.lowConfidence", { name: suggestedName, pct, identifier: identifier.name });
      view.setSpecies({ name: t("result.unknownSpecies"), note, noteKind: "warn" });
    } else if (!suggestedName) {
      view.setSpecies({ name: t("result.unknownSpecies"), note: t("inat.species.none"), noteKind: "warn" });
    } else if (state.suggested === undefined) {
      view.setSpecies({ ...plain, origin, note: t("inat.species.matching") });
    } else if (state.suggested) {
      view.setSpecies({ name: tx.common_name || tx.name, sci: tx.common_name ? tx.name : "", photo: tx.photo, origin });
    } else {
      view.setSpecies({ ...plain, origin, note: t("inat.species.sentAsName"), noteKind: "warn" });
    }

    view.setConfirm({ visible: onSuggestion, checked: state.confirmed });
    view.setChangeLabel(onSuggestion || state.picked ? "inat.species.change" : "inat.species.suggestName");
    view.setSpeciesHint(
      state.picked ? t("inat.species.pickedHint")
        : state.unknown ? t("inat.species.unknownHint")
        : !onSuggestion ? ""
        : state.confirmed ? t("inat.species.humanHint")
        : t("inat.species.autoHint"),
    );
    // Low confidence: the button swaps between the suggestion and none at all
    if (canWithhold) {
      view.showSpeciesReset(true, state.unknown ? "inat.species.useSuggestion" : "inat.species.sendUnknown");
    } else {
      view.showSpeciesReset(!!state.picked);
    }
  }

  if (suggestedName) {
    inatTaxonForSuggestion({ gbif_id: identify?.gbif_id ?? null, name: identify.name, locale })
      .catch((e) => { console.warn("[InatUpload] iNat match failed:", e); return null; })
      .then((taxon) => { state.suggested = taxon; renderSpecies(); });
  }
  renderSpecies();

  const openSearch = () => {
    view.openSearch();
    view.setSearchResults([unsureItem]);
  };
  if (!suggestedName) openSearch();

  view.onChangeSpecies(openSearch);
  view.onConfirm((checked) => {
    state.confirmed = checked;
    renderSpecies();
  });
  view.onResetSpecies(() => {
    state.unknown = canWithhold && !state.unknown;
    state.picked = null;
    state.gbifKey = null;
    state.confirmed = false;
    renderSpecies();
  });

  let searchTimer = 0;
  let searchCtrl = null;
  view.onSearchInput((raw) => {
    const q = raw.trim();
    clearTimeout(searchTimer);
    searchCtrl?.abort();
    if (q.length < 2) {
      view.setSearchResults([unsureItem]);
      view.setSearchStatus("");
      return;
    }
    searchTimer = setTimeout(async () => {
      const ctrl = (searchCtrl = new AbortController());
      view.setSearchStatus(t("inat.search.searching"));
      try {
        const taxa = (await inatAutocomplete(q, { locale, signal: ctrl.signal })).map(slimTaxon);
        if (ctrl.signal.aborted) return;
        view.setSearchResults([unsureItem, ...taxa.map(itemOf)]);
        view.setSearchStatus(taxa.length ? "" : t("inat.search.none"));
      } catch (e) {
        if (e?.name === "AbortError") return;
        view.setSearchResults([unsureItem]);
        view.setSearchStatus(t("inat.search.failed"));
      }
    }, SEARCH_DEBOUNCE_MS);
  });

  view.onPick((taxon) => {
    view.closeSearch();
    state.unknown = false;
    // Picking what the identifier already said is not a correction.
    if (state.suggested && taxon.id === state.suggested.id) {
      state.picked = null;
      state.gbifKey = null;
      // Finding it again by hand is checking it.
      state.confirmed = true;
    } else {
      state.picked = taxon;
      state.confirmed = false;
      // A species is filed under its GBIF id like every other in PlantGo;
      // asked now, so it is in hand by the time the link is written. A genus,
      // family or "Plants" is not something PlantGo keys anything on, so it
      // keeps its iNat id and rank only.
      state.gbifKey = Number(taxon.rank_level) <= 10 ? gbifKeyForInatTaxon(taxon) : null;
    }
    renderSpecies();
  });

  // --- location & fields -----------------------------------------------------
  view.mountMap({ lat, lon, accuracy }, (p) => { state.position = p; });

  view.setGeoprivacy(readGeoprivacy());
  view.onGeoprivacyChange(writeGeoprivacy);
  // Notes start empty: iNat shows them to everyone, so only the player writes them.

  // --- upload ----------------------------------------------------------------
  async function correction() {
    const c = {};
    if (state.picked) {
      c.speciesName = state.picked.name;
      c.rank = state.picked.rank || null;
      c.inat_taxon_id = state.picked.id;
      c.vernacularName = state.picked.common_name || null;
      c.gbif_id = await (state.gbifKey || Promise.resolve(null)).catch(() => null);
    }
    if (state.position.moved) {
      c.location = { lat: state.position.lat, lon: state.position.lon };
      c.positional_accuracy = state.position.accuracy;
    }
    return Object.keys(c).length ? c : null;
  }

  async function createObservation(token) {
    view.setStatus(t("inat.progress.creating"));
    // Unknown sends neither taxon nor name, which iNat shows as "Unknown"
    const taxon = state.unknown ? null : state.picked || state.suggested || null;
    const guess = state.unknown ? null : taxon?.name || suggestedName || null;
    const fields = view.getFields();
    const pos = state.position;
    const observation = {
      uuid: state.uuid,
      species_guess: guess || undefined,
      taxon_id: taxon?.id ?? undefined,
      observed_on_string: isoWithOffset(observedAt || new Date()),
      latitude: pos.lat,
      longitude: pos.lon,
      positional_accuracy: pos.accuracy != null ? Math.round(pos.accuracy) : undefined,
      geoprivacy: fields.geoprivacy,
      captive_flag: fields.captive,
      description: fields.notes || undefined,
      // iNat's own flag for an ID that came from computer vision: true only
      // for the identifier's suggestion as it was, not one the player checked.
      owners_identification_from_vision: idSource() === "auto",
    };

    let obs = null;
    try {
      obs = await inatCreateObservation(token, observation);
    } catch (e) {
      if (e?.status === 401) throw e;
      // The create may have landed with its answer lost (or landed on an
      // earlier try): the uuid says whether it did.
      obs = await inatFindByUuid(state.uuid, token).catch(() => null);
      if (!obs) throw e;
    }
    if (!obs?.id) throw new Error(t("inat.error.noId"));

    state.created = { id: obs.id, uuid: obs.uuid || state.uuid, url: inatObservationUrl(obs.id) };
    view.lockForm();
    onUploaded?.(state.created.url);

    const inat = {
      id: state.created.id,
      uuid: state.created.uuid,
      url: state.created.url,
      taxon_id: taxon?.id ?? null,
      taxon_name: guess,
      id_source: idSource(),
      photos_uploaded: 0,
      photos_total: files.length,
    };
    // The iNat side is done whatever happens here; a failed save is logged,
    // not allowed to fail the upload.
    try {
      const userCorrection = await correction();
      if (observationId) {
        await setObservationInat(userId, observationId, { inat, userCorrection });
      } else {
        observationId = await addUnscoredObservation({
          userId,
          speciesName: identify?.name || t("result.unknownSpecies"),
          lat, lon,
          identifier,
          identify_score: score,
          gbif_id: identify?.gbif_id ?? null,
          vernacularName: identify?.vernacularName || null,
          inat,
          userCorrection,
        });
      }
    } catch (e) {
      console.error("[InatUpload] saving the iNat link failed:", e);
    }
  }

  async function uploadPhotos(token) {
    try {
      for (let i = state.photosDone; i < files.length; i++) {
        view.setStatus(t("inat.progress.photo", { n: i + 1, total: files.length }));
        const { file } = await resizeImage(files[i], PHOTO_MAX_DIM);
        await inatUploadPhoto(token, state.created.id, file);
        state.photosDone = i + 1;
      }
    } finally {
      if (observationId && state.photosDone) {
        setObservationInatPhotos(userId, observationId, state.photosDone)
          .catch((e) => console.error("[InatUpload] saving the photo count failed:", e));
      }
    }
  }

  view.onSubmit(async () => {
    if (state.done) { view.close(); return; }
    if (state.busy) return;
    if (inatToken.status().state !== "valid") { refreshGate(); return; }
    const token = inatToken.get();

    state.busy = true;
    view.setBusy(true);
    view.setStatus("");
    try {
      if (!state.created) await createObservation(token);
      await uploadPhotos(token);
      state.done = true;
      view.setStatus("");
      view.showDone(state.created.url);
      view.setSubmitLabel("common.close");
    } catch (e) {
      console.error("[InatUpload] upload failed:", e);
      if (e?.status === 401) {
        inatToken.clear();
        view.setStatus(t("inat.error.token"), "error");
        refreshGate();
      } else if (state.created) {
        view.setStatus(t("inat.error.photos", { done: state.photosDone, total: files.length }), "error");
        view.setSubmitLabel("inat.retryPhotos");
      } else {
        view.setStatus(t("inat.error.create", { message: e?.message || "" }), "error");
      }
    } finally {
      state.busy = false;
      view.setBusy(false);
      view.setSubmitEnabled(state.done || inatToken.status().state === "valid");
    }
  });

  refreshGate();
  return { close: () => view.close() };
}
