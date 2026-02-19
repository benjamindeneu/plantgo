// src/ui/components/ResultModal.view.js
import { t, translateDom } from "../../language/i18n.js";

export function createResultModalView() {
  const overlay = document.createElement("div");
  overlay.className = "modal show result-modal";
  overlay.setAttribute("role", "dialog");

  overlay.innerHTML = `
    <div class="modal-content result">
      <canvas class="confetti-canvas" aria-hidden="true"></canvas>
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

  const confetti = createNatureConfettiEngine(overlay);

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

  function burstNatureConfetti(rootEl, opts = {}) {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;

    const bursts = opts.bursts ?? 1;

    // Ensure layer exists
    let layer = rootEl.querySelector(".nature-confetti-layer");
    if (!layer) {
      layer = document.createElement("div");
      layer.className = "nature-confetti-layer";
      rootEl.appendChild(layer);
    }

    // Compute origin: horizontally centered, vertically at the level info
    // We target the top strip (level-wrap) because that's exactly what you described.
    const anchor = rootEl.querySelector(".level-wrap.at-top") || rootEl.querySelector(".level-wrap") || rootEl;
    const rootRect = rootEl.getBoundingClientRect();
    const aRect = anchor.getBoundingClientRect();

    const originXpx = rootRect.left + rootRect.width * 0.5;     // center horizontally
    const originYpx = aRect.top + aRect.height * 0.55;          // around level text line

    const originXPct = ((originXpx - rootRect.left) / rootRect.width) * 100;
    const originYPct = ((originYpx - rootRect.top) / rootRect.height) * 100;

    const particles = [
      { kind: "leaf", theme: "leaf-1" },
      { kind: "leaf", theme: "leaf-2" },
      { kind: "leaf", theme: "leaf-3" },
      { kind: "flower", theme: "flw-1" },
      { kind: "flower", theme: "flw-2" },
      { kind: "flower", theme: "flw-3" },
    ];

    const spawnBurst = () => {
      const count = 42; // a bit more for “celebration”
      const spread = 140; // wider burst fan

      for (let i = 0; i < count; i++) {
        const pDef = particles[(Math.random() * particles.length) | 0];
        const el = document.createElement("span");
        el.className = `nature-confetti ${pDef.kind} ${pDef.theme}`;

        // 🎯 Start exactly at the requested origin
        el.style.left = `${originXPct}%`;
        el.style.top = `${originYPct}%`;

        // Longer life
        const dur = 2600 + Math.random() * 1200; // 2.6s–3.8s
        const delay = Math.random() * 180;

        // Size variety
        const base = pDef.kind === "leaf" ? 12 : 10;
        const size = base + Math.random() * 18;

        // Burst direction: UP first
        // angle in degrees (0 = right, -90 = up)
        const angle = (-160 + Math.random() * 140); // -160..-20 (mostly upward, slight sides)
        const power = 240 + Math.random() * 260;    // initial push magnitude

        const dx = Math.cos((angle * Math.PI) / 180) * power;
        const dyUp = Math.sin((angle * Math.PI) / 180) * power; // negative value = up

        // Total fall distance (gravity will bring it down)
        const fall = 520 + Math.random() * 420;

        const rot = (Math.random() * 980 - 490) | 0;

        el.style.setProperty("--dx", `${dx}px`);
        el.style.setProperty("--dyUp", `${dyUp}px`);
        el.style.setProperty("--fall", `${fall}px`);
        el.style.setProperty("--rot", `${rot}deg`);
        el.style.setProperty("--dur", `${dur}ms`);
        el.style.setProperty("--delay", `${delay}ms`);
        el.style.setProperty("--sz", `${size}px`);

        layer.appendChild(el);
        setTimeout(() => el.remove(), dur + delay + 300);
      }
    };

    for (let b = 0; b < bursts; b++) setTimeout(spawnBurst, b * 320);
  }

  function createNatureConfettiEngine(rootEl) {
    const canvas = rootEl.querySelector(".confetti-canvas");
    if (!canvas) return null;

    const ctx = canvas.getContext("2d", { alpha: true });
    let W = 0, H = 0, dpr = 1;

    const particles = [];
    let raf = 0;
    let running = false;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      W = Math.max(1, Math.floor(rect.width));
      H = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // call once + on resize
    resize();
    const ro = new ResizeObserver(() => resize());
    ro.observe(canvas);

    // palettes (tune to match your UI)
    const leafPal = [
      ["#1f6b4e", "#9fe3c6"],
      ["#2f7a58", "#6cc7a2"],
      ["#2a8a62", "#4fb18a"],
    ];
    const flowerPal = [
      ["#d7b46a", "#f4e2a6"], // gold-ish
      ["#9aa3ad", "#e7edf5"], // silver-ish
      ["#b77a55", "#f0c3a7"], // bronze-ish
    ];

    function rand(a, b) { return a + Math.random() * (b - a); }

    // Draw a modern “leaf” (simple bezier + gradient)
    function drawLeaf(x, y, r, rot, c1, c2) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);

      const w = r * 0.9;
      const h = r * 1.35;

      const grad = ctx.createLinearGradient(-w, -h, w, h);
      grad.addColorStop(0, c1);
      grad.addColorStop(1, c2);

      ctx.fillStyle = grad;
      ctx.beginPath();
      // teardrop-ish leaf
      ctx.moveTo(0, -h);
      ctx.bezierCurveTo(w, -h * 0.65, w, h * 0.25, 0, h);
      ctx.bezierCurveTo(-w, h * 0.25, -w, -h * 0.65, 0, -h);
      ctx.closePath();
      ctx.fill();

      // subtle midrib highlight
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(1, r * 0.08);
      ctx.beginPath();
      ctx.moveTo(0, -h * 0.75);
      ctx.quadraticCurveTo(r * 0.15, 0, 0, h * 0.72);
      ctx.stroke();

      ctx.restore();
      ctx.globalAlpha = 1;
    }

    // Draw a “flower” as 6 rounded petals + gradient
    function drawFlower(x, y, r, rot, c1, c2) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);

      const grad = ctx.createLinearGradient(-r, -r, r, r);
      grad.addColorStop(0, c1);
      grad.addColorStop(1, c2);

      ctx.fillStyle = grad;

      const petals = 6;
      for (let i = 0; i < petals; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI * 2) / petals);
        ctx.beginPath();
        // rounded petal (capsule-like)
        const pw = r * 0.55;
        const ph = r * 1.15;
        ctx.moveTo(0, -ph);
        ctx.quadraticCurveTo(pw, -ph * 0.6, pw, 0);
        ctx.quadraticCurveTo(pw, ph * 0.55, 0, ph * 0.75);
        ctx.quadraticCurveTo(-pw, ph * 0.55, -pw, 0);
        ctx.quadraticCurveTo(-pw, -ph * 0.6, 0, -ph);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // center
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    function spawnBurst({ x, y, count = 44 }) {
      // physics knobs
      const gravity = 1200;       // px/s^2
      const airDrag = 0.985;      // velocity damping per frame-ish (we apply via dt)
      const spinDrag = 0.985;
      const baseUp = 720;         // initial upward speed
      const side = 520;           // sideways speed
      const wind = rand(-40, 40); // gentle bias

      for (let i = 0; i < count; i++) {
        const isLeaf = Math.random() < 0.6;

        const [c1, c2] = (isLeaf ? leafPal : flowerPal)[(Math.random() * 3) | 0];
        const size = rand(8, 18) * (isLeaf ? 1.2 : 1.0);

        // angle mostly upward (-90°), allow spread
        const ang = (-Math.PI / 2) + rand(-0.95, 0.95);
        const speed = rand(baseUp * 0.75, baseUp * 1.15);

        particles.push({
          kind: isLeaf ? "leaf" : "flower",
          x, y,
          vx: Math.cos(ang) * rand(side * 0.45, side * 1.0) + wind,
          vy: Math.sin(ang) * speed,
          g: gravity * rand(0.9, 1.15),
          drag: rand(airDrag * 0.985, airDrag),
          w: rand(-6.5, 6.5),      // angular vel
          wDrag: rand(spinDrag * 0.985, spinDrag),
          rot: rand(0, Math.PI * 2),
          r: size,
          life: rand(2.8, 4.2),     // seconds
          age: 0,
          c1, c2,
          sway: rand(0.8, 1.6),     // wind wobble strength
          phase: rand(0, Math.PI * 2),
        });
      }

      if (!running) {
        running = true;
        tick(performance.now());
      }
    }

    function tick(t) {
      raf = requestAnimationFrame(tick);
      // dt in seconds
      const now = t;
      tick.last = tick.last || now;
      const dt = Math.min(0.033, (now - tick.last) / 1000);
      tick.last = now;

      ctx.clearRect(0, 0, W, H);

      // if nothing left, stop
      if (!particles.length) {
        cancelAnimationFrame(raf);
        raf = 0;
        running = false;
        return;
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.age += dt;

        // fade out toward end
        const fade = Math.max(0, Math.min(1, 1 - (p.age / p.life)));
        const alpha = fade * fade; // nicer fade curve

        // wind sway (makes it feel natural)
        const sway = Math.sin((p.age * 3.2) + p.phase) * 18 * p.sway;

        // integrate physics
        p.vy += p.g * dt;
        p.vx *= Math.pow(p.drag, dt * 60);
        p.vy *= Math.pow(p.drag, dt * 60);
        p.rot += p.w * dt;
        p.w *= Math.pow(p.wDrag, dt * 60);

        p.x += (p.vx + sway) * dt;
        p.y += p.vy * dt;

        // draw
        ctx.globalAlpha = alpha;
        if (p.kind === "leaf") drawLeaf(p.x, p.y, p.r, p.rot, p.c1, p.c2);
        else drawFlower(p.x, p.y, p.r, p.rot, p.c1, p.c2);

        // cleanup
        if (p.age >= p.life || p.y > H + 60) particles.splice(i, 1);
      }

      ctx.globalAlpha = 1;
    }

    function destroy() {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      particles.length = 0;
      running = false;
    }

    return { spawnBurst, destroy, resize };
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

      if (leveledUp && confetti) {
        // origin: middle horizontally, at the level information line vertically
        const rootRect = overlay.getBoundingClientRect();
        const anchor = overlay.querySelector(".level-wrap.at-top") || overlay.querySelector(".level-wrap");
        const aRect = anchor ? anchor.getBoundingClientRect() : rootRect;

        const x = (rootRect.width * 0.5);
        const y = (aRect.top - rootRect.top) + (aRect.height * 0.55);

        confetti.spawnBurst({ x, y, count: 52 });
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
