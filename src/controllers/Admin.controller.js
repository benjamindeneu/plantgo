// src/controllers/Admin.controller.js
import { auth } from "../../firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";

import { t } from "../language/i18n.js";
import { isAdmin, resetQuiz } from "../data/user.repo.js";
import { renderChecking, renderAdmin } from "../ui/components/Admin.view.js";

/**
 * The admin page. Anyone without the flag is sent back to the front page:
 * the tools here are all about undoing what the app has recorded.
 */
export function AdminController(container) {
  renderChecking(container, t("admin.checking"));

  async function run(userId) {
    let admin = false;
    try {
      admin = await isAdmin(userId);
    } catch (e) {
      console.error("Admin: could not read role", e);
    }
    if (!admin) {
      location.replace("./index.html");
      return;
    }

    renderAdmin(container, {
      onResetQuiz: () => resetQuiz(userId),
    });
  }

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      location.replace("./login.html");
      return;
    }
    run(user.uid);
  });
}
