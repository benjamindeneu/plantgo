// src/controllers/Lab.controller.js
import { auth } from "../../firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";

import { t } from "../language/i18n.js";
import { isAdmin, isTester, generateQuiz } from "../data/user.repo.js";
import { getGeneratedQuizSpecies } from "../data/quizSpecies.js";
import { renderChecking } from "../ui/components/Admin.view.js";
import { renderLab } from "../ui/components/Lab.view.js";

/**
 * The field lab page, for field testers and admins. Anyone else is sent back
 * to the front page. Nothing here is a secret — what testers are actually
 * served (SwissFMSDM) is decided by the server, not by this page.
 */
export function LabController(container) {
  renderChecking(container, t("admin.checking"));

  async function run(userId) {
    const [admin, tester] = await Promise.all([
      isAdmin(userId).catch((e) => { console.error("Lab: could not read role", e); return false; }),
      isTester(),
    ]);
    if (!admin && !tester) {
      location.replace("./index.html");
      return;
    }
    renderLab(container, {
      onGenerateQuiz: async () => generateQuiz(userId, await getGeneratedQuizSpecies(userId)),
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
