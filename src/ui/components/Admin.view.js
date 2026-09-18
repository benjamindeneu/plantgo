// src/ui/components/Admin.view.js
import { t } from "../../language/i18n.js";

export function renderChecking(container, msg) {
  container.innerHTML = `<div class="mp-quiz mp-quiz-status"><span class="mp-quiz-spinner" aria-hidden="true"></span><p></p></div>`;
  container.querySelector("p").textContent = msg;
}

/**
 * One section per tool. Each is a heading, a line saying what the button
 * will do, the button, and a status line that reports how it went.
 */
export function renderAdmin(container, { onResetQuiz }) {
  container.innerHTML = "";
  container.appendChild(section({
    title: t("admin.quiz.title"),
    desc: t("admin.quiz.desc"),
    action: t("admin.quiz.reset"),
    done: t("admin.quiz.done"),
    error: t("admin.quiz.error"),
    run: onResetQuiz,
  }));
}

function section({ title, desc, action, done, error, run }) {
  const el = document.createElement("section");
  el.className = "mp-admin__section";
  el.innerHTML = `
    <h2></h2>
    <p class="mp-admin__desc"></p>
    <button type="button"></button>
    <p class="mp-admin__status" hidden></p>
  `;
  el.querySelector("h2").textContent = title;
  el.querySelector(".mp-admin__desc").textContent = desc;
  const btn = el.querySelector("button");
  btn.textContent = action;
  const status = el.querySelector(".mp-admin__status");

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    status.hidden = true;
    status.classList.remove("mp-admin__status--error");
    try {
      await run();
      status.textContent = done;
    } catch (e) {
      console.error("Admin action failed", e);
      status.textContent = error;
      status.classList.add("mp-admin__status--error");
    } finally {
      status.hidden = false;
      btn.disabled = false;
    }
  });

  return el;
}
