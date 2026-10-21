// src/controllers/SettingsModal.controller.js
import { Modal } from "../ui/components/Modal.js";
import { INAT_MARK } from "../ui/components/organIcons.js";
import { t } from "../language/i18n.js";
import { debugMode } from "../data/debugMode.js";
import { InatTokenForm } from "./InatTokenForm.controller.js";

/** Opens the settings modal. Mounted from the header menu. */
export function openSettingsModal() {
  const modal = Modal({ title: t("settings.title") });
  const body = modal.querySelector(".body");

  const label = document.createElement("label");
  label.className = "settings-toggle";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = debugMode.get();
  checkbox.addEventListener("change", () => debugMode.set(checkbox.checked));
  label.append(checkbox, document.createTextNode(t("settings.debugMode")));
  body.appendChild(label);

  // iNaturalist: the token that lets a result be posted there.
  const inat = document.createElement("section");
  inat.className = "mp-inat-settings";
  inat.innerHTML = `
    <h3 class="mp-inat__label mp-inat-settings__title">${INAT_MARK}<span></span></h3>
    <p class="mp-inat__hint"></p>
  `;
  inat.querySelector(".mp-inat-settings__title span").textContent = t("settings.inat.title");
  inat.querySelector(".mp-inat__hint").textContent = t("settings.inat.hint");
  inat.appendChild(InatTokenForm().element);
  body.appendChild(inat);

  document.body.appendChild(modal);
  return modal;
}
