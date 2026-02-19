// src/ui/components/ResultModal.view.js
import { t, translateDom } from "../../language/i18n.js";
import confetti from "https://unpkg.com/canvas-confetti@1.6.0/dist/confetti.module.mjs";

export function createResultModalView() {
  const overlay = document.createElement("div");
  overlay.className = "modal show result-modal";
  overlay.setAttribute("role", "dialog");

  overlay.innerHTML = `
    <div class="modal-content result">
      <!-- LEVEL TOP -->
      <div class="level-wrap at-top">
        <div class="level-line">
          <span><span data-i18n="result.level">Level</span> <span id="levelFrom">1</span></span>
          <span id="levelToLabel">→ <span id="levelTo">2</span></span>
        </div>
        <div class="progress-rail">
          <div class="progress-bar" id="levelProgress"></div>
        </div>
      </div>

      <div class="result-body">
        <!-- <div data-i18n="result.yourObservation">Your observation:</div> -->
        <div class="user-photos center" id="userPhotos"></div>

        <div class="result-head">
          <h2 id="resultTitle" data-i18n="result.identifying">Identifying…</h2>
          <div id=speciesNameDiv class="card">
            <div id="speciesNameLine" class="muted big-text"></div>
            <div id="speciesVernacularNameLine" class="muted big-text"></div>
            <div id="speciesScoreLine" class="muted small-text"></div>
            <div class="loading-track" id="loadingTrack" aria-hidden="true">
              <div class="loading-indeterminate"></div>
            </div>
          </div>
        </div>

        <div class="result-points">
          <div class="muted" style="margin-bottom:6px; text-align:center;" data-i18n="result.observationPoints">
            Observation points:
          </div>

          <div class="points-stack" style="display:flex; flex-direction:column; align-items:center;">
            <div id="obsBadge"
                class="points-badge common-points"
                data-rarity="common-points">
                <span class="value"><span id="pointsCounter">0</span></span>
            </div>
          </div>

          <div class="details" id="pointsDetails"></div>
        </div>

        <div class="badges big" id="badges" style="display:none"></div>

        <div class="result-total" id="finalTotalWrap" style="display:none">
          <div class="big">
            <span data-i18n="result.total">Total:</span>
            <strong><span id="finalTotal">0</span></strong>
            <span data-i18n="result.ptsShort">pts</span>
          </div>
        </div>
      </div>

      <div class="result-actions">
        <button class="primary" id="doneBtn" type="button" data-i18n="result.done">Done</button>
      </div>
    </div>
  `;

  translateDom(overlay);

  overlay.querySelector("#doneBtn").addEventListener("click", () => overlay.remove());
  const qs = (sel) => overlay.querySelector(sel);

  /* ---------- helpers (visual only) ---------- */
  const clamp01 = (v) => Math.max(0, Math.min(100, v));

  // rarity helpers
  const getRarity = (val) => (val >= 1500 ? "legendary-points" :
                               val >= 1000 ? "epic-points" :
                               val >= 500  ? "rare-points" : "common-points");

  const rarityText = (cls) =>
    cls === "legendary-points" ? t("result.rarity.legendary") :
    cls === "epic-points"      ? t("result.rarity.epic") :
    cls === "rare-points"      ? t("result.rarity.rare") :
                                 t("result.rarity.common");

  function getEaseFn(name) {
    switch ((name || "linear").toLowerCase()) {
      case "easeout":
      case "ease-out":
        return (tt) => 1 - Math.pow(1 - tt, 3);
      case "linear":
      default:
        return (tt) => tt;
    }
  }

  function setBadgeRarityClass(el, rarity) {
    el.classList.remove("common-points", "rare-points", "epic-points", "legendary-points");
    el.dataset.rarity = rarity;
    el.classList.add(rarity);
  }

  function upgradeBadgeBy(val, el) {
    const next = getRarity(val);
    const prev = el.dataset.rarity || "";
    if (prev === next) return;
    setBadgeRarityClass(el, next);
    el.classList.remove("points-pop");
    void el.offsetWidth;
    el.classList.add("points-pop");
  }

  function animateProgress(el, fromPct, toPct, options = {}) {
    const duration = 900, start = performance.now();
    const ease = getEaseFn(options.ease || "linear");
    return new Promise((res) => {
      function frame(ts) {
        const tt = Math.min(1, (ts - start) / duration);
        const e = ease(tt);
        const v = Math.round(fromPct + (toPct - fromPct) * e);
        el.style.width = `${v}%`;
        if (tt < 1) requestAnimationFrame(frame); else res();
      }
      requestAnimationFrame(frame);
    });
  }

  function fireLevelUpConfetti() {
    // Fullscreen (library creates its own fixed canvas), not clipped by modal
    // Better motion defaults + respects reduced motion:
    const levelWrap =
      overlay.querySelector(".level-wrap.at-top") ||
      overlay.querySelector(".level-wrap") ||
      overlay;

    const r = levelWrap.getBoundingClientRect();
    const origin = {
      x: 0.5,
      y: Math.max(0, Math.min(1, (r.top + r.height * 0.55) / window.innerHeight)),
    };

    // ✅ Leaf + flower shapes (real silhouettes)
    const leaf = confetti.shapeFromPath({
      path: "M12 2 C18 4 22 10 20 16 C18 22 12 24 8 20 C4 16 6 8 12 2 Z",
    });

    const flower = confetti.shapeFromPath({
      path: "M12 2 C13.8 4.4 16.4 5 18.8 4.2 C18 6.6 18.6 9.2 21 11 C18.6 12.8 18 15.4 18.8 17.8 C16.4 17 13.8 17.6 12 20 C10.2 17.6 7.6 17 5.2 17.8 C6 15.4 5.4 12.8 3 11 C5.4 9.2 6 6.6 5.2 4.2 C7.6 5 10.2 4.4 12 2 Z",
    });

    // ✅ Better palettes
    const LEAF_COLORS = [
      "#00C853", // vivid fresh green
      "#00E676", // bright green
      "#2ECC71", // fresh
      "#00BFA5", // green-teal
      "#1DE9B6", // mint
    ];

    const FLOWER_COLORS = [
      "#FF2D95", // hot pink
      "#FF4FB3", // pink
      "#FF5A5F", // coral-pink
      "#FF7A18", // orange
      "#FFA62B", // warm orange
    ];

    // Long + nice gravity: run small bursts for ~4.5s
    const end = Date.now() + 4500;

    (function frame() {
      confetti({
        particleCount: 18,
        startVelocity: 62,
        spread: 90,
        ticks: 320,                 // stays longer
        gravity: 1.15,              // nice fall
        drift: (Math.random() * 0.8 - 0.4),
        scalar: 1.05,
        origin,
        shapes: [leaf],
        colors: LEAF_COLORS,
        zIndex: 99999,
        disableForReducedMotion: true,
      });

      confetti({
        particleCount: 12,
        startVelocity: 58,
        spread: 86,
        ticks: 320,
        gravity: 1.10,
        drift: (Math.random() * 0.8 - 0.4),
        scalar: 0.95,
        origin,
        shapes: [flower],
        colors: FLOWER_COLORS,
        zIndex: 99999,
        disableForReducedMotion: true,
      });

      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  }

  function showBadge(container, badge) {
    return new Promise((r) => {
      const node = document.createElement("div");
      node.className = "badge big";

      // badge.label should already be translated by controller
      if (badge.rawHTML) node.innerHTML = badge.label;
      else node.innerHTML = `<span class="icon">${badge.emoji}</span><span class="txt">${escapeHtml(badge.label)}</span>${badge.bonus != null ? `<span class="add">+${badge.bonus}</span>` : ""}`;

      container.appendChild(node);
      requestAnimationFrame(() => {
        node.classList.add("in");
        setTimeout(r, 500);
      });
    });
  }

  function calcFromLevel(total) {
    const L = Math.floor(1 + total / 11000);
    const prev = (L - 1) * 11000, next = L * 11000;
    const pct = Math.round(((total - prev) / (next - prev)) * 100);
    return { fromLevel: L, nextLevel: L + 1, fromPct: clamp01(pct) };
  }
  function calcToLevel(total) {
    const L = Math.floor(1 + total / 11000);
    const prev = (L - 1) * 11000, next = L * 11000;
    const pct = Math.round(((total - prev) / (next - prev)) * 100);
    return { toLevel: L, toPct: clamp01(pct) };
  }

  // Update static UI labels + existing detail line labels (no animation restart)
  function refreshI18n() {
    // data-i18n elements handled globally by setLanguage()
    // But these are dynamic inserts we must update ourselves:

    // Update rarity label if present
    const badgeEl = qs("#obsBadge");
    const rarityCls = badgeEl?.dataset?.rarity;
    if (rarityCls) {
      const valueEl = badgeEl.querySelector(".value");
      const counter = badgeEl.querySelector("#pointsCounter");
      const rarityLabelEl = badgeEl.querySelector(".rarity-label");
      if (valueEl && counter && rarityLabelEl) {
        rarityLabelEl.textContent = rarityText(rarityCls);
      } else if (valueEl && counter && !rarityLabelEl) {
        // if value wrapper exists but label wasn't injected yet, do nothing
      }
    }

    // Update existing detail lines' labels, if we stored keys in dataset
    qs("#pointsDetails")?.querySelectorAll(".detail-line[data-k]").forEach((line) => {
      const k = line.getAttribute("data-k");
      const labelSpan = line.querySelector("span");
      if (labelSpan && k) labelSpan.textContent = t(k);
    });
  }

  document.addEventListener("i18n:changed", () => {
    translateDom(overlay);
    refreshI18n(); // your existing dynamic update (rarity label + detail lines)
  });

  /* ---------- public view API ---------- */
  return {
    el: overlay,

    refreshI18n,

    async initLoading({ photos, currentTotalPoints }) {
      const { fromLevel, fromPct, nextLevel } = calcFromLevel(currentTotalPoints || 0);
      qs("#levelFrom").textContent = fromLevel;
      qs("#levelTo").textContent = nextLevel;
      qs("#levelToLabel").style.opacity = 0.9;
      qs("#levelProgress").style.width = `${fromPct}%`;

      const photosEl = qs("#userPhotos");
      photosEl.innerHTML = (photos || [])
        .map((url) => `<div class="shot"><img src="${url}" alt="${escapeHtml(t("result.yourPhotoAlt"))}" loading="lazy"/></div>`)
        .join("");

      qs("#resultTitle").textContent = t("result.identifying");
      qs("#speciesNameLine").textContent = "";
      qs("#speciesVernacularNameLine").textContent = "";
      qs("#speciesScoreLine").textContent = "";
      qs("#loadingTrack").style.display = "block";

      const obsBadge = qs("#obsBadge");
      setBadgeRarityClass(obsBadge, "common-points");

      qs("#badges").style.display = "none";
      qs("#finalTotalWrap").style.display = "none";
      qs("#pointsDetails").innerHTML = "";
    },

    async showResultUI({ speciesName, speciesVernacularName, speciesScore, baseTotal, detail, badges, currentTotalBefore, finalTotal }) {
      const loading = qs("#loadingTrack");
      const title = qs("#resultTitle");
      const speciesLine = qs("#speciesNameLine");
      const speciesVernacularLine = qs("#speciesVernacularNameLine");
      const speciesScoreLine = qs("#speciesScoreLine");
      const badgeEl = qs("#obsBadge");
      const counterEl = qs("#pointsCounter");
      const valueWrapper = counterEl.parentElement; // .value
      const detailsEl = qs("#pointsDetails");
      const badgesEl = qs("#badges");

      loading.style.display = "none";
      title.textContent = t("result.newObservationOf");

      //speciesLine.textContent = speciesName || t("result.unknownSpecies");
      //speciesVernacularLine.textContent = speciesVernacularName || t("result.noCommonName");
      speciesLine.innerHTML = speciesName
        ? `<em>${speciesName}</em>`
        : t("result.unknownSpecies");

      speciesVernacularLine.innerHTML = speciesVernacularName
        ? `<strong>${speciesVernacularName}</strong>`
        : t("result.noCommonName");

      speciesScoreLine.textContent =
        `${t("result.confidence")} ${speciesScore ?? ""}`;

      await animateObservation(
        { total: baseTotal, detail, counterEl, detailsEl, badgeEl },
        { ease: "linear" }
      );

      const rarityClass = getRarity(baseTotal);
      const rarityLabel = rarityText(rarityClass);
      setBadgeRarityClass(badgeEl, rarityClass);

      //valueWrapper.innerHTML = `<span id="pointsCounter">${escapeHtml(counterEl.textContent)}</span><br><span class="rarity-label">${escapeHtml(rarityLabel)}</span>`;
      valueWrapper.innerHTML = `<span id="pointsCounter">${escapeHtml(counterEl.textContent)}</span> <span class="rarity-label">${escapeHtml(rarityLabel)}</span>`;

      if (badges && badges.length) {
        badgesEl.style.display = "block";
        for (const b of badges) await showBadge(badgesEl, b);
      }

      qs("#finalTotal").textContent = String(finalTotal);
      qs("#finalTotalWrap").style.display = "block";

      const { fromLevel, fromPct } = calcFromLevel(currentTotalBefore);
      const { toLevel, toPct } = calcToLevel(currentTotalBefore + finalTotal);

      const leveledUp = toLevel > fromLevel;

      await animateProgress(qs("#levelProgress"), fromPct, toPct, { ease: "easeOut" });

      if (leveledUp) {
        fireLevelUpConfetti();
      }

      qs("#levelFrom").textContent = toLevel;
      qs("#levelTo").textContent = toLevel + 1;
      qs("#levelToLabel").style.opacity = 0.9;

      // make sure any translated dynamic labels are correct
      refreshI18n();
    },
  };

  // ----- local to view -----
  function animateObservation({ total, detail, counterEl, detailsEl, badgeEl }, options = {}) {
    const entries = Object.entries(detail || {});
    detailsEl.innerHTML = "";

    const duration = 1800;
    const start = performance.now();
    const ease = getEaseFn(options.ease || "linear");
    const revealPortion = 0.7;
    const revealTimes = entries.map((_, i) => (i + 1) / (entries.length || 1) * (duration * revealPortion));
    let revealed = 0;

    return new Promise((resolve) => {
      function frame(ts) {
        const elapsed = ts - start;
        const tt = Math.min(1, elapsed / duration);
        const val = Math.round(total * ease(tt));
        counterEl.textContent = String(val);
        upgradeBadgeBy(val, badgeEl);

        while (revealed < revealTimes.length && elapsed >= revealTimes[revealed]) {
          const [k, v] = entries[revealed];
          const line = document.createElement("div");
          line.className = "detail-line";
          line.setAttribute("data-k", k); // ✅ store key so we can retranslate on language change
          line.innerHTML = `<span>${escapeHtml(t(k))}</span><span>+${escapeHtml(v)}</span>`;
          detailsEl.appendChild(line);
          revealed++;
        }

        if (tt < 1) requestAnimationFrame(frame);
        else {
          for (; revealed < entries.length; revealed++) {
            const [k, v] = entries[revealed];
            const line = document.createElement("div");
            line.className = "detail-line";
            line.setAttribute("data-k", k);
            line.innerHTML = `<span>${escapeHtml(t(k))}</span><span>+${escapeHtml(v)}</span>`;
            detailsEl.appendChild(line);
          }
          counterEl.textContent = String(total);
          upgradeBadgeBy(total, badgeEl);
          resolve();
        }
      }
      requestAnimationFrame(frame);
    });
  }
}

function escapeHtml(s) {
  const str = String(s ?? "");
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
