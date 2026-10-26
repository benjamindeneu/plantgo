// src/ui/components/Admin.view.js
import { t } from "../../language/i18n.js";

export function renderChecking(container, msg) {
  container.innerHTML = `<div class="mp-quiz mp-quiz-status"><span class="mp-quiz-spinner" aria-hidden="true"></span><p></p></div>`;
  container.querySelector("p").textContent = msg;
}

/**
 * One section per tool. Each is a heading, a line saying what the button
 * will do, the button, and a status line that reports how it went. The field
 * lab (Lab.view.js) is built from the same sections.
 */
export function renderAdmin(container, { eventOptions = [], eventValue = "", onEventChange }) {
  container.innerHTML = "";
  container.appendChild(choiceSection({
    title: t("admin.event.title"),
    desc: t("admin.event.desc"),
    options: [{ value: "", label: t("admin.event.off") }, ...eventOptions],
    value: eventValue,
    onChange: onEventChange,
  }));
}

/**
 * A tool that picks rather than fires: the event simulator.
 *
 * Choosing reloads the page, because the override is read once per page by
 * the pass card, the wardrobe and the theme — a reload is both the honest
 * way to show what a player would see and the simplest.
 */
function choiceSection({ title, desc, options, value, onChange }) {
  const el = document.createElement("section");
  el.className = "mp-admin__section";
  el.innerHTML = `
    <h2></h2>
    <p class="mp-admin__desc"></p>
    <select class="mp-admin__select"></select>
  `;
  el.querySelector("h2").textContent = title;
  el.querySelector(".mp-admin__desc").textContent = desc;

  const select = el.querySelector("select");
  for (const opt of options) {
    const o = document.createElement("option");
    o.value = opt.value;
    o.textContent = opt.label;
    select.appendChild(o);
  }
  select.value = value;
  select.addEventListener("change", () => onChange?.(select.value));
  return el;
}

export function section({ title, desc, action, done, error, run }) {
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
      status.textContent = typeof error === "function" ? error(e) : error;
      status.classList.add("mp-admin__status--error");
    } finally {
      status.hidden = false;
      btn.disabled = false;
    }
  });

  return el;
}
