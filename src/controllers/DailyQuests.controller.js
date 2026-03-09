// src/controllers/DailyQuests.controller.js
import { createDailyQuestsView } from "../ui/components/DailyQuests.view.js";
import { subscribeDailyQuests } from "../data/dailyQuests.js";
import { auth } from "../../firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";

export function DailyQuests() {
  const view = createDailyQuestsView();

  let unsubQuests = null;

  onAuthStateChanged(auth, (user) => {
    if (unsubQuests) { unsubQuests(); unsubQuests = null; }
    if (!user) return;

    unsubQuests = subscribeDailyQuests(user.uid, (quests) => {
      view.updateQuests(quests);
    });
  });

  return view.element;
}
