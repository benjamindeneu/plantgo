// src/ui/components/InatTokenForm.view.js
import { t, translateDom } from "../../language/i18n.js";
import { INAT_TOKEN_URL } from "../../api/inaturalist.js";

/**
 * Where the player pastes their iNaturalist token: two steps, a field, a
 * status line. The same few lines in Settings and in the upload popup, so
 * they are learnt once.
 */
export function createInatTokenFormView() {
  const el = document.createElement("div");
  el.className = "mp-inat-token";
  el.innerHTML = `
    <ol class="mp-inat-token__steps">
      <li><span data-i18n="inat.token.step1"></span> <a class="mp-inat-token__link" target="_blank" rel="noopener noreferrer">inaturalist.org/users/api_token</a></li>
      <li data-i18n="inat.token.step2"></li>
    </ol>
    <div class="mp-inat-token__row">
      <!-- A text field, not a password one: browsers fill any password field
           with the PlantGo login and offer to save the token as a password.
           The data-* attributes keep password-manager extensions off it too. -->
      <input class="input mp-inat-token__input" type="text" name="inat-api-token" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
             data-1p-ignore data-lpignore="true" data-bwignore="true" data-form-type="other" data-i18n-placeholder="inat.token.placeholder">
      <button class="primary" type="button" data-act="save" data-i18n="inat.token.save"></button>
    </div>
    <p class="mp-inat-token__status" role="status"></p>
    <button class="mp-inat__textbtn mp-inat-token__remove" type="button" data-i18n="inat.token.remove" hidden></button>
  `;
  el.querySelector(".mp-inat-token__link").href = INAT_TOKEN_URL;
  translateDom(el);

  const input = el.querySelector(".mp-inat-token__input");
  const save = el.querySelector('[data-act="save"]');
  const status = el.querySelector(".mp-inat-token__status");
  const remove = el.querySelector(".mp-inat-token__remove");

  let onSave = null;
  const submit = () => onSave?.(input.value);
  save.addEventListener("click", submit);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } });

  return {
    element: el,
    /** kind: "" | "ok" | "warn" | "error" */
    setStatus(text, kind = "") {
      status.textContent = text || "";
      status.dataset.kind = kind;
    },
    setBusy(busy) {
      save.disabled = busy;
      input.disabled = busy;
    },
    setRemovable(removable) { remove.hidden = !removable; },
    clearInput() { input.value = ""; },
    onSave(cb) { onSave = cb; },
    onRemove(cb) { remove.addEventListener("click", cb); },
  };
}
