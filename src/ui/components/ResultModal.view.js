// src/ui/components/ResultModal.view.js
import { t, translateDom } from "../../language/i18n.js";
import confetti from "https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.4/dist/confetti.module.mjs";

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

  function fireLevelUpConfettiOld() {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;

    const levelWrap =
      overlay.querySelector(".level-wrap.at-top") ||
      overlay.querySelector(".level-wrap") ||
      overlay;

    const r = levelWrap.getBoundingClientRect();
    const origin = {
      x: 0.5,
      y: Math.max(0, Math.min(1, (r.top + r.height * 0.55) / window.innerHeight)),
    };

    // Fresh intense greens + pink/orange
    const LEAF_COLORS = ["#00C853", "#00E676", "#2ECC71", "#00BFA5", "#1DE9B6"];
    const FLOWER_COLORS = ["#FF2D95", "#FF4FB3", "#FF5A5F", "#FF7A18", "#FFA62B"];

    // shapes
    const leaf = confetti.shapeFromPath({
      path: "M12 2 C7 5,4 10,6 14 C8 18,14 19,18 16 C20 13,20 8,12 2 Z"
    });

    const flower = confetti.shapeFromPath({
      // 6 rounded petals daisy silhouette
      path: "M12 6.2 C13.3 4.1 16 4.2 16.8 6.1 C18.6 5.9 20.0 7.4 19.6 9.2 C21.3 10.1 21.3 12.6 19.6 13.5 C20.0 15.3 18.6 16.8 16.8 16.6 C16.0 18.5 13.3 18.6 12 16.5 C10.7 18.6 8.0 18.5 7.2 16.6 C5.4 16.8 4.0 15.3 4.4 13.5 C2.7 12.6 2.7 10.1 4.4 9.2 C4.0 7.4 5.4 5.9 7.2 6.1 C8.0 4.2 10.7 4.1 12 6.2 Z"
    });


    const rand = (a, b) => a + Math.random() * (b - a);

    // ✅ “One burst” made of several instant micro-shots (same moment)
    const microShots = 8; // increase to 10 if you want more variety

    for (let i = 0; i < microShots; i++) {
      // randomize the feel per micro-shot
      const startVelocity = rand(28, 52);
      const spread = rand(78, 120);
      const ticks = Math.floor(rand(180, 320));
      const gravity = rand(1.15, 1.85);
      const drift = rand(-0.45, 0.45);

      // small origin jitter (keeps it organic)
      const ox = origin.x + rand(-0.018, 0.018);
      const oy = origin.y + rand(-0.010, 0.010);

      // Leaves
      confetti({
        particleCount: Math.floor(rand(8, 14)),
        startVelocity,
        spread,
        ticks,
        gravity,
        drift,
        scalar: rand(1.80, 2.20),
        origin: { x: ox, y: oy },
        colors: LEAF_COLORS,
        shapes: [leaf],
        flat: true,
        zIndex: 99999,
        disableForReducedMotion: true,
      });

      // Flowers
      confetti({
        particleCount: Math.floor(rand(6, 11)),
        startVelocity: startVelocity * rand(0.85, 1.05),
        spread: spread * rand(0.9, 1.05),
        ticks: Math.floor(ticks * rand(0.9, 1.1)),
        gravity: gravity * rand(0.9, 1.05),
        drift: drift + rand(-0.2, 0.2),
        scalar: rand(2.0, 2.40),
        origin: { x: ox, y: oy },
        colors: FLOWER_COLORS,
        shapes: [flower],
        flat: true,
        zIndex: 99999,
        disableForReducedMotion: true,
      });
    }
  }

  function fireLevelUpConfettiOld2() {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;

    const levelWrap =
      overlay.querySelector(".level-wrap.at-top") ||
      overlay.querySelector(".level-wrap") ||
      overlay;

    const r = levelWrap.getBoundingClientRect();
    const origin = {
      x: 0.5,
      y: Math.max(0, Math.min(1, (r.top + r.height * 0.55) / window.innerHeight)),
    };

    // Refined organic palette
    const LEAF_COLORS = ["#27ae60", "#2ecc71", "#a2d149"];
    const FLOWER_COLORS = ["#ff79c6", "#ffb86c", "#ff5555"];

    // A true 5-petal cherry blossom/plumeria shape
    const flower = confetti.shapeFromPath({
      path: "M12 12c0-2.7 2.2-5 5-5s5 2.2 5 5-2.2 5-5 5-5-2.2-5-5zm-1.5-1.1c-1.6-2.2-1.1-5.3 1.1-6.9 2.2-1.6 5.3-1.1 6.9 1.1 1.6 2.2 1.1 5.3-1.1 6.9-2.2 1.6-5.3 1.1-6.9-1.1zm-4.7 6.1c1.1-2.5 4-3.7 6.5-2.6 2.5 1.1 3.7 4 2.6 6.5-1.1 2.5-4 3.7-6.5 2.6-2.5-1.1-3.7-4-2.6-6.5zm-1.8-8.2c2.5-1.1 5.4.1 6.5 2.6 1.1 2.5-.1 5.4-2.6 6.5-2.5 1.1-5.4-.1-6.5-2.6-1.1-2.5.1-5.4 2.6-6.5zM7.1 20.2c-2.2-1.6-2.7-4.7-1.1-6.9 1.6-2.2 4.7-2.7 6.9-1.1 2.2 1.6 2.7 4.7 1.1 6.9-1.6 2.2-4.7 2.7-6.9 1.1z"
    });

    // An asymmetric "willow" leaf that flutters better
    const leaf = confetti.shapeFromPath({
      path: "M2 18C2 18 5 16 7 11C9 6 8 1 8 1C8 1 12 4 13 9C14 14 11 20 11 20C11 20 6 22 2 18Z"
    });

    const botanicalMix = [leaf, leaf, leaf, leaf, flower];

    const fire = (particleRatio, opts) => {
      confetti({
        ...opts,
        origin: { x: origin.x, y: origin.y },
        particleCount: Math.floor(200 * particleRatio),
        disableForReducedMotion: true,
        zIndex: 99999,
      });
    };

    // 1. Initial High Burst (The "Pop")
    // Using standard shapes for the "inner" core explosion
    fire(0.25, {
      spread: 40,
      startVelocity: 55,
      scalar: 1.2,
      shapes: ["circle", "square"], 
      colors: [...LEAF_COLORS, ...FLOWER_COLORS],
    });

    // 2. Wide Mid-Shot (The "Bloom") - Primarily Leaves
    setTimeout(() => {
      fire(0.2, {
        spread: 100,
        startVelocity: 35,
        scalar: 1.8,
        gravity: 0.8,
        shapes: botanicalMix, // 80% leaf, 20% flower
        colors: LEAF_COLORS,
      });
    }, 100);

    // 3. The "After-Drift" (Organic Fall) - Mostly falling petals
    setTimeout(() => {
      fire(0.3, {
        spread: 160,
        startVelocity: 25,
        decay: 0.92,
        scalar: 2.2, // Flowers look nice larger
        gravity: 0.6,
        drift: 0.5,
        shapes: botanicalMix, // 80% leaf, 20% flower
        colors: FLOWER_COLORS,
      });
    }, 250);
  }

  function fireLevelUpConfetti() {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;

    const levelWrap =
      document.querySelector(".level-wrap.at-top") ||
      document.querySelector(".level-wrap") ||
      document.body;

    const r = levelWrap.getBoundingClientRect();
    const origin = {
      x: 0.5,
      y: Math.max(0, Math.min(1, (r.top + r.height * 0.55) / window.innerHeight)),
    };

    const randomInRange = (min, max) => Math.random() * (max - min) + min;
    
    // Helper to force the library to pick exactly one random color per particle
    const getRandomColor = (colorsArray) => colorsArray[Math.floor(Math.random() * colorsArray.length)];

    const LEAF_COLORS = ["#27ae60", "#2ecc71", "#a2d149"];
    const FLOWER_COLORS = ["#ff79c6", "#ffb86c"];

    const flower = confetti.shapeFromPath({
      path: "M 9.1 8.0 A 4.5 4.5 0 1 1 14.9 8.0 A 4.5 4.5 0 1 1 16.8 13.5 A 4.5 4.5 0 1 1 12.0 17.0 A 4.5 4.5 0 1 1 7.2 13.5 A 4.5 4.5 0 1 1 9.1 8.0 Z"
    });

    const leaf = confetti.shapeFromPath({
      path: "M 12 2 C 20 5 22 15 12 22 C 2 15 4 5 12 2 Z"
    });

    const fireBatch = (count, isFlower, baseSettings) => {
      for (let i = 0; i < count; i++) {
        confetti({
          origin: { 
            x: origin.x + randomInRange(-0.02, 0.02), 
            y: origin.y + randomInRange(-0.02, 0.02) 
          },
          particleCount: 1, 
          shapes: isFlower ? [flower] : [leaf],
          // Pass only ONE distinct color so it mixes perfectly
          colors: [getRandomColor(isFlower ? FLOWER_COLORS : LEAF_COLORS)],
          disableForReducedMotion: true,
          zIndex: 99999,
          flat: true, 
          
          // 1. Independent rotation & spin
          rotation: randomInRange(0, 360),
          spin: randomInRange(-0.8, 0.8),

          // 3. Tighter randomness ranges so they don't get pushed too far
          spread: baseSettings.spread + randomInRange(-15, 15),
          startVelocity: baseSettings.startVelocity + randomInRange(-8, 8),
          gravity: baseSettings.gravity + randomInRange(-0.1, 0.15),
          decay: baseSettings.decay + randomInRange(-0.01, 0.01),
          drift: baseSettings.drift + randomInRange(-0.4, 0.4), // Softer horizontal flutter
          ticks: baseSettings.ticks + randomInRange(-20, 50),
          angle: baseSettings.angle + randomInRange(-10, 10),
          
          scalar: isFlower ? randomInRange(1.4, 1.9) : randomInRange(0.9, 1.3),
        });
      }
    };

    // 1. Initial High Burst (The "Pop")
    // Gravity increased to 0.8
    const popBase = {
      spread: 50, startVelocity: 45, gravity: 0.8, decay: 0.9, drift: 0, ticks: 200, angle: 90
    };
    fireBatch(60, false, popBase); 
    fireBatch(8, true, popBase);   

    // 2. Wide Mid-Shot (The "Bloom")
    // Gravity increased to 0.65
    setTimeout(() => {
      const bloomBase = {
        spread: 90, startVelocity: 35, gravity: 0.65, decay: 0.92, drift: 0, ticks: 300, angle: 90
      };
      fireBatch(50, false, bloomBase); 
      fireBatch(6, true, bloomBase);
    }, randomInRange(80, 120));

    // 3. The "After-Drift" (Organic Fall)
    // Gravity increased to 0.5
    setTimeout(() => {
      const driftBase = {
        spread: 130, startVelocity: 25, gravity: 0.5, decay: 0.94, drift: 0, ticks: 500, angle: 90
      };
      fireBatch(40, false, driftBase); 
      fireBatch(10, true, driftBase);
    }, randomInRange(230, 270));
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
