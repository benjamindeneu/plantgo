// src/ui/components/InfoSheet.view.js
import { t } from "../../language/i18n.js";
import { MISSION_BONUS_BY_TIER } from "../../data/missions.repo.js";

/**
 * A full-screen explainer for one of the sheet's tabs.
 *
 * Full screen rather than a small dialog: this is the one place the app gets
 * to say what a mission actually *is*, and that answer is several paragraphs
 * of plain language, not a tooltip. It covers the map so there is nothing to
 * read past.
 */
// The full write-up of how a mission is detected, scored, drawn and graded —
// the long answer to the short one this sheet gives. Document-relative on
// purpose: every page of the app sits at the site root, so the link resolves
// whether the app is served from a domain root or from a project sub-path.
// English only for now, which the label says in every other language.
const PIPELINE_DOC_URL = "mission-pipeline.html";

const CONTENT = {
  missions: {
    titleKey: "map.info.missions.title",
    icon: "🎯",
    introKey: "map.info.missions.intro",
    howTitleKey: "map.info.missions.howTitle",
    points: [
      { icon: "🤔", key: "map.info.missions.how1" },
      { icon: "🔍", key: "map.info.missions.how2" },
      { icon: "📍", key: "map.info.missions.how3" },
    ],
    gradesTitleKey: "map.info.missions.gradesTitle",
    grades: [
      { tier: "common", labelKey: "missions.card.common" },
      { tier: "rare", labelKey: "missions.card.rare" },
      { tier: "epic", labelKey: "missions.card.epic" },
      { tier: "legendary", labelKey: "missions.card.legendary" },
    ],
    noteKey: "map.info.missions.note",
    docKey: "map.info.missions.doc",
    docUrl: PIPELINE_DOC_URL,
  },
  around: {
    titleKey: "map.info.around.title",
    icon: "🌿",
    introKey: "map.info.around.intro",
    howTitleKey: null,
    points: [{ icon: "🛰", key: "map.info.around.how" }],
    noteKey: "map.info.around.note",
  },
};

/** @param {"missions"|"around"} kind */
export function createInfoSheet(kind) {
  const spec = CONTENT[kind];
  if (!spec) return null;

  const root = document.createElement("div");
  root.className = "mp-info";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.innerHTML = `
    <div class="mp-info__bar">
      <span class="mp-info__icon" aria-hidden="true"></span>
      <h2 class="mp-info__title"></h2>
      <button class="mp-info__close" type="button">&times;</button>
    </div>
    <div class="mp-info__body">
      <p class="mp-info__intro"></p>
      <h3 class="mp-info__how" hidden></h3>
      <ul class="mp-info__points"></ul>
      <h3 class="mp-info__how mp-info__grades-title" hidden></h3>
      <ul class="mp-info__points mp-info__grades" hidden></ul>
      <p class="mp-info__note"></p>
      <a class="mp-info__doc" target="_blank" rel="noopener noreferrer" hidden></a>
    </div>
  `;

  root.querySelector(".mp-info__icon").textContent = spec.icon;
  root.querySelector(".mp-info__title").textContent = t(spec.titleKey);
  root.querySelector(".mp-info__intro").textContent = t(spec.introKey);
  root.querySelector(".mp-info__note").textContent = t(spec.noteKey);

  const how = root.querySelector(".mp-info__how");
  if (spec.howTitleKey) {
    how.hidden = false;
    how.textContent = t(spec.howTitleKey);
  }

  const doc = root.querySelector(".mp-info__doc");
  if (spec.docKey) {
    doc.hidden = false;
    doc.href = spec.docUrl;
    doc.textContent = t(spec.docKey);
    doc.appendChild(Object.assign(document.createElement("span"), {
      textContent: "\u00a0↗", ariaHidden: "true",
    }));
  }

  const list = root.querySelector(".mp-info__points");
  for (const point of spec.points) {
    const li = document.createElement("li");
    li.className = "mp-info__point";
    li.innerHTML = `<span class="mp-info__point-icon" aria-hidden="true"></span><span></span>`;
    li.firstElementChild.textContent = point.icon;
    li.lastElementChild.textContent = t(point.key);
    list.appendChild(li);
  }

  const gradesTitle = root.querySelector(".mp-info__grades-title");
  const gradesList = root.querySelector(".mp-info__grades");
  if (spec.gradesTitleKey && spec.grades?.length) {
    gradesTitle.hidden = false;
    gradesTitle.textContent = t(spec.gradesTitleKey);
    gradesList.hidden = false;
    for (const grade of spec.grades) {
      const li = document.createElement("li");
      li.className = "mp-info__grade";
      li.innerHTML = `<span class="mp-tag"></span><span class="mp-info__grade-points"></span>`;
      const chip = li.firstElementChild;
      if (grade.tier !== "common") chip.classList.add(`mp-tag--${grade.tier}`);
      chip.textContent = t(grade.labelKey);
      li.lastElementChild.textContent =
        `+${MISSION_BONUS_BY_TIER[grade.tier]} ${t("missions.card.points")}`;
      gradesList.appendChild(li);
    }
  }

  const closeBtn = root.querySelector(".mp-info__close");
  closeBtn.setAttribute("aria-label", t("common.close"));

  function close() {
    root.remove();
    document.removeEventListener("keydown", onKey);
  }
  function onKey(e) { if (e.key === "Escape") close(); }

  closeBtn.addEventListener("click", close);
  document.addEventListener("keydown", onKey);

  root.close = close;
  return root;
}
