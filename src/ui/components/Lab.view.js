// src/ui/components/Lab.view.js
import { t } from "../../language/i18n.js";
import { section } from "./Admin.view.js";

/**
 * The field lab: what a field tester has that other players do not. A note
 * on the early access they have, then their tools — the same sections as the
 * admin page.
 */
export function renderLab(container, { onGenerateQuiz }) {
  container.innerHTML = "";

  const access = document.createElement("section");
  access.className = "mp-admin__section";
  access.innerHTML = `<h2></h2><p class="mp-admin__desc"></p>`;
  access.querySelector("h2").textContent = t("lab.access.title");
  access.querySelector(".mp-admin__desc").textContent = t("lab.access.desc");
  container.appendChild(access);

  container.appendChild(section({
    title: t("lab.quiz.title"),
    desc: t("lab.quiz.desc"),
    action: t("lab.quiz.generate"),
    done: t("lab.quiz.done"),
    error: (e) => t(e?.code === "not-enough-species" ? "lab.quiz.notEnough" : "lab.quiz.error"),
    run: onGenerateQuiz,
  }));
}
