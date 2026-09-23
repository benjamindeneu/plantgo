// src/controllers/EventPass.controller.js
import { createEventPassView } from "../ui/components/EventPass.view.js";
import { Modal } from "../ui/components/Modal.js";
import { activeEvent, subscribeEventProgress } from "../data/events.js";
import { subscribeAvatar } from "../data/avatar.js";
import { t } from "../language/i18n.js";
import { auth } from "../../firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";

/**
 * The running event's pass card, for the map sheet.
 *
 * When no event is running the card stays hidden and nothing is
 * subscribed — outside a window this costs one date comparison.
 */
export function EventPassCard() {
  const view = createEventPassView();
  const event = activeEvent();
  view.setEvent(event);

  let unsubProgress = null;
  let unsubAvatar = null;

  view.setOnOpen(() => {
    const modal = Modal({ title: `${event.emoji} ${t(event.nameKey)}`, content: view.buildTrack() });
    // Its own class: the pass sizes itself to the screen and scrolls only
    // its ladder, which is not how the app's other modals behave.
    modal.classList.add("mp-pass-modal", `is-${event.theme}`);
    document.body.appendChild(modal);
  });

  const stopAuth = onAuthStateChanged(auth, (user) => {
    if (unsubProgress) { unsubProgress(); unsubProgress = null; }
    if (unsubAvatar) { unsubAvatar(); unsubAvatar = null; }
    if (!user || !event) return;

    unsubProgress = subscribeEventProgress(user.uid, event.id, (p) => view.setProgress(p));
    // The track previews each tier on the player's own character, so it
    // needs the avatar as well as the progress.
    unsubAvatar = subscribeAvatar(user.uid, (avatar) => view.setAvatar(avatar));
  });

  const el = view.element;
  el.stop = () => {
    stopAuth();
    if (unsubProgress) unsubProgress();
    if (unsubAvatar) unsubAvatar();
  };
  return el;
}
