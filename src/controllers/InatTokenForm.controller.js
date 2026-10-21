// src/controllers/InatTokenForm.controller.js
import { createInatTokenFormView } from "../ui/components/InatTokenForm.view.js";
import { inatToken } from "../data/inatToken.js";
import { inatMe } from "../api/inaturalist.js";
import { t } from "../language/i18n.js";

/** Hours left, rounded up, so a token about to lapse never reads "0 h". */
function hoursLeft(expiresAt) {
  return Math.max(1, Math.ceil((expiresAt - Date.now()) / 3600000));
}

/** One line on the token as it stands: { text, kind } for a status line. */
export function describeInatToken() {
  const { state, expiresAt } = inatToken.status();
  if (state === "missing") return { text: t("inat.token.missing"), kind: "" };
  if (state === "expired") return { text: t("inat.token.expired"), kind: "warn" };
  const login = inatToken.login();
  const who = login ? t("inat.token.connectedAs", { login }) : t("inat.token.connected");
  const left = expiresAt ? t("inat.token.expiresIn", { hours: hoursLeft(expiresAt) }) : "";
  return { text: [who, left].filter(Boolean).join(" · "), kind: "ok" };
}

/**
 * The token form, wired: saving checks the token against iNat before calling
 * it connected, and `onChange` hears about every save or removal.
 */
export function InatTokenForm({ onChange } = {}) {
  const view = createInatTokenFormView();

  const render = () => {
    const { text, kind } = describeInatToken();
    view.setStatus(text, kind);
    view.setRemovable(inatToken.status().state !== "missing");
  };

  view.onSave(async (raw) => {
    const token = inatToken.set(raw);
    if (!token) { view.setStatus(t("inat.token.empty"), "error"); return; }
    // A token already past its time would only earn a 401; say so now.
    if (inatToken.status().state === "expired") {
      inatToken.clear();
      view.setStatus(t("inat.token.stale"), "error");
      view.setRemovable(false);
      onChange?.(inatToken.status());
      return;
    }
    view.setBusy(true);
    view.setStatus(t("inat.token.checking"));
    try {
      const me = await inatMe(token);
      inatToken.setLogin(me?.login);
      view.clearInput();
      render();
    } catch (e) {
      if (e?.status === 401) {
        inatToken.clear();
        view.setStatus(t("inat.token.rejected"), "error");
        view.setRemovable(false);
      } else {
        // iNat unreachable: keep the token, it may well be fine.
        view.clearInput();
        view.setStatus(t("inat.token.unchecked"), "warn");
        view.setRemovable(true);
      }
    } finally {
      view.setBusy(false);
      onChange?.(inatToken.status());
    }
  });

  view.onRemove(() => {
    inatToken.clear();
    render();
    onChange?.(inatToken.status());
  });

  render();
  return { element: view.element, refresh: render };
}
