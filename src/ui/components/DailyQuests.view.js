// src/ui/components/DailyQuests.view.js
import { t } from "../../language/i18n.js";

const QUEST_META = {
  daily_observations: { icon: "🌿", labelKey: "quests.obs.label", descKey: "quests.obs.desc" },
  inventory:          { icon: "📍", labelKey: "quests.inv.label", descKey: "quests.inv.desc" },
  mission:            { icon: "🎯", labelKey: "quests.mis.label", descKey: "quests.mis.desc" },
};

const SLIDE_MS = 220;
const ROTATE_MS = 9000;

export function createDailyQuestsView() {
  const section = document.createElement("section");
  section.className = "card daily-quests";

  let currentIndex = 0;
  let quests = [];
  let autoTimer = null;
  let isAnimating = false;

  // ── Build static shell ──────────────────────────────────────────────────
  section.innerHTML = `
    <div class="dq-label">
      <div class="dq-title"></div>
      <div class="dq-label-bottom">
        <span class="dq-count"></span>
        <div class="dq-dots"></div>
      </div>
    </div>
    <div class="dq-sep"></div>
    <div class="dq-body">
      <div class="dq-quest">
        <div class="dq-quest-icon"></div>
        <div class="dq-quest-info">
          <div class="dq-quest-label"></div>
          <div class="dq-progress-row">
            <div class="dq-progress-bar-track">
              <div class="dq-progress-bar-fill"></div>
            </div>
            <span class="dq-progress-text"></span>
            <span class="dq-reward">🏆 +1000</span>
          </div>
        </div>
        <div class="dq-check" aria-hidden="true">✓</div>
      </div>
    </div>
  `;

  const titleEl    = section.querySelector(".dq-title");
  const countEl    = section.querySelector(".dq-count");
  const iconEl     = section.querySelector(".dq-quest-icon");
  const labelEl    = section.querySelector(".dq-quest-label");
  const fillEl     = section.querySelector(".dq-progress-bar-fill");
  const progressEl = section.querySelector(".dq-progress-text");
  const checkEl    = section.querySelector(".dq-check");
  const questEl    = section.querySelector(".dq-quest");
  const dotsEl     = section.querySelector(".dq-dots");

  // ── Populate quest card content (no progress-bar animation) ─────────────
  function populateContent() {
    if (!quests.length) return;
    const quest = quests[currentIndex];
    const meta = QUEST_META[quest.id] || { icon: "❓", labelKey: quest.id, descKey: "" };
    const pct = quest.goal > 0 ? (quest.progress / quest.goal) * 100 : 0;

    iconEl.textContent  = meta.icon;
    labelEl.textContent = t(meta.labelKey);

    // Instant width (no bar transition during slide)
    fillEl.style.transition = "none";
    fillEl.style.width = `${Math.min(pct, 100)}%`;

    progressEl.textContent = quest.completed ? t("quests.completed") : `${quest.progress} / ${quest.goal}`;
    questEl.classList.toggle("dq-quest--done", quest.completed);
    checkEl.style.display = quest.completed ? "flex" : "none";
  }

  // ── Update shared header + dots ──────────────────────────────────────────
  function updateMeta() {
    const completed = quests.filter(q => q.completed).length;
    countEl.textContent = `${completed}/${quests.length}`;
    dotsEl.querySelectorAll(".dq-dot").forEach((dot, i) => {
      dot.classList.toggle("dq-dot--active", i === currentIndex);
      dot.classList.toggle("dq-dot--done", quests[i]?.completed);
    });
  }

  // ── Full render (with progress-bar animation, for data updates) ──────────
  function renderQuest() {
    if (!quests.length) return;
    populateContent();
    fillEl.style.transition = ""; // re-enable for data-driven updates
    const quest = quests[currentIndex];
    const pct = quest.goal > 0 ? (quest.progress / quest.goal) * 100 : 0;
    fillEl.style.width = `${Math.min(pct, 100)}%`;
    updateMeta();
  }

  // ── Slide transition ──────────────────────────────────────────────────────
  function goToQuest(newIndex) {
    if (!quests.length || isAnimating || newIndex === currentIndex) return;
    isAnimating = true;

    // 1) Exit: slide out to the left
    questEl.style.transition = `transform ${SLIDE_MS}ms ease, opacity ${SLIDE_MS}ms ease`;
    questEl.style.transform = "translateX(-36px)";
    questEl.style.opacity   = "0";

    setTimeout(() => {
      currentIndex = newIndex;

      // 2) Update content while invisible, positioned off-right
      populateContent();
      updateMeta();
      questEl.style.transition = "none";
      questEl.style.transform  = "translateX(36px)";
      questEl.style.opacity    = "0";

      // 3) Force reflow then slide in from the right
      questEl.getBoundingClientRect();
      questEl.style.transition = `transform ${SLIDE_MS}ms ease, opacity ${SLIDE_MS}ms ease`;
      questEl.style.transform  = "";
      questEl.style.opacity    = "";

      setTimeout(() => {
        isAnimating = false;
        fillEl.style.transition = ""; // restore bar animation
      }, SLIDE_MS + 20);
    }, SLIDE_MS);
  }

  // ── Dots ─────────────────────────────────────────────────────────────────
  function buildDots() {
    dotsEl.innerHTML = "";
    quests.forEach((_, i) => {
      const dot = document.createElement("button");
      dot.className = "dq-dot" + (i === currentIndex ? " dq-dot--active" : "");
      dot.setAttribute("aria-label", `Quest ${i + 1}`);
      dot.addEventListener("click", () => { goToQuest(i); startAutoRotate(); });
      dotsEl.appendChild(dot);
    });
  }

  // ── Auto-rotate ───────────────────────────────────────────────────────────
  function startAutoRotate() {
    if (autoTimer) clearInterval(autoTimer);
    autoTimer = setInterval(() => {
      if (!quests.length) return;
      goToQuest((currentIndex + 1) % quests.length);
    }, ROTATE_MS);
  }

  startAutoRotate();

  // ── i18n ─────────────────────────────────────────────────────────────────
  function applyTranslations() {
    titleEl.textContent = t("quests.title");
    if (quests.length) renderQuest();
  }
  document.addEventListener("i18n:changed", applyTranslations);
  applyTranslations();

  // ── Public API ────────────────────────────────────────────────────────────
  function updateQuests(newQuests) {
    quests = newQuests;
    buildDots();
    renderQuest();
  }

  return { element: section, updateQuests };
}
