// src/ui/components/EventPass.view.js
import { t } from "../../language/i18n.js";
import { daysLeft, nextTier, tierToken } from "../../data/events.js";
import { AVATAR_SLOTS, slotItems, itemNameKey, slotNameKey } from "../../data/avatar.js";
import { avatarSvg, avatarImg } from "./Avatar.view.js";

/**
 * The event pass: the card that rides above the map sheet's lists, and the
 * full track behind it.
 *
 * The card is deliberately small and says three things — how long is left,
 * how far along the bar is, what the next tier gives. The track is where
 * the whole ladder lives, every tier drawn as the avatar already wearing
 * the item, the way the wardrobe draws its tiles.
 *
 * The theme is one class on the root (`is-<theme>`), so a later event
 * re-colours both by changing that word.
 */

const LOCK_ICON = `<svg viewBox="0 0 24 24" width="11" height="11" aria-hidden="true"><path fill="currentColor" d="M17 9h-1V7a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2zm-7-2a2 2 0 1 1 4 0v2h-4V7z"/></svg>`;
const CHECK_ICON = `<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path fill="currentColor" d="M9.6 16.2 5.4 12l-1.4 1.4 5.6 5.6 12-12-1.4-1.4z"/></svg>`;

/** What a tier hands over: [{ slot, item }] across every wardrobe slot. */
function rewardsOf(eventId, tier) {
  const token = tierToken(eventId, tier);
  return AVATAR_SLOTS.flatMap((slot) =>
    slotItems(slot).filter((it) => it.requires === token).map((item) => ({ slot, item }))
  );
}

/** A tier's rewards as one line, or its number when it gives none. */
function rewardNames(rewards, tier) {
  return rewards.length
    ? rewards.map(({ slot, item }) => t(itemNameKey(slot, item.id))).join(" · ")
    : t("events.pass.tierShort", { n: tier });
}

/** What kind of thing a tier gives — "Hat", "Outfit", "Props", "Eyes". */
function rewardKinds(rewards) {
  return [...new Set(rewards.map(({ slot }) => t(slotNameKey(slot))))].join(" · ");
}

/**
 * How full the rung leading to this tier is, 0…1 — the segment from the
 * tier before it (or from 0, for the first). The ladder shows progress
 * between the steps, not only at them.
 */
function rungFill(event, step, xp) {
  const prevXp = event.tiers.find((t) => t.tier === step.tier - 1)?.xp ?? 0;
  if (xp >= step.xp) return 1;
  if (xp <= prevXp) return 0;
  return (xp - prevXp) / Math.max(1, step.xp - prevXp);
}

/**
 * A segment runs between two nodes, so it is drawn in two half-rungs in
 * two different rows: the bottom half of the row above, then the top half
 * of the row below. Its fill has to cross the first half before any of the
 * second shows, or the line breaks and restarts from the middle of the gap.
 */
const clamp01 = (n) => Math.max(0, Math.min(1, n));
const firstHalf = (pct) => clamp01(pct * 2);
const secondHalf = (pct) => clamp01((pct - 0.5) * 2);

function fmtXp(n) {
  try {
    return new Intl.NumberFormat(document.documentElement.lang || "en").format(Math.round(n));
  } catch {
    return String(Math.round(n));
  }
}

/**
 * One tier, drawn as the avatar wearing what it gives. A colour-only tier
 * has nothing to wear, so the avatar shows the colour applied instead —
 * which is exactly what the player would get.
 */
function rewardPortrait(avatar, rewards, { big = false } = {}) {
  const dressed = { ...avatar };
  for (const { slot, item } of rewards) dressed[slot] = item.id;
  // The fitting room's portrait is drawn inline; the list's coins are baked.
  return big ? avatarSvg(dressed) : avatarImg(dressed, { px: 44 });
}

export function createEventPassView() {
  const root = document.createElement("div");
  root.className = "mp-event";
  root.hidden = true;

  let event = null;
  let xp = 0;
  let tier = 0;
  let avatar = null;
  let onOpen = null;

  root.innerHTML = `
    <button class="mp-event__card" type="button">
      <span class="mp-event__emoji" aria-hidden="true"></span>
      <span class="mp-event__body">
        <span class="mp-event__top">
          <span class="mp-event__name"></span>
          <span class="mp-event__days"></span>
        </span>
        <span class="mp-event__rail"><span class="mp-event__fill"></span></span>
        <span class="mp-event__next"></span>
      </span>
      <span class="mp-event__tier"><span class="mp-event__tier-n"></span></span>
    </button>
  `;

  const card = root.querySelector(".mp-event__card");
  card.addEventListener("click", () => onOpen?.());

  function renderCard() {
    if (!event) { root.hidden = true; return; }
    root.hidden = false;
    root.className = `mp-event is-${event.theme}`;

    root.querySelector(".mp-event__emoji").textContent = event.emoji;
    root.querySelector(".mp-event__name").textContent = t(event.nameKey);

    const left = daysLeft(event);
    root.querySelector(".mp-event__days").textContent = left === 1
      ? t("events.card.lastDay")
      : t("events.card.daysLeft", { n: left });

    const next = nextTier(event, xp);
    root.querySelector(".mp-event__fill").style.width = `${Math.round((next ? next.pct : 1) * 100)}%`;
    root.querySelector(".mp-event__tier-n").textContent = String(tier);

    const nextLine = root.querySelector(".mp-event__next");
    if (!next) {
      nextLine.textContent = t("events.card.complete");
    } else {
      const rewards = rewardsOf(event.id, next.tier);
      const name = rewards.length ? t(itemNameKey(rewards[0].slot, rewards[0].item.id)) : t("events.pass.tierShort", { n: next.tier });
      nextLine.textContent = t("events.card.next", { xp: fmtXp(next.remaining), item: name });
    }
    card.setAttribute("aria-label", `${t(event.nameKey)} — ${t("events.pass.open")}`);
  }

  /**
   * The full track, as a detachable element the caller puts in a modal.
   *
   * Every tier is a button: tapping one dresses the portrait in the head
   * with what that tier gives, locked or not. Seeing the thing on your own
   * character is the reason to go and earn it, so the locked ones are the
   * important half of that.
   */
  function buildTrack() {
    const wrap = document.createElement("div");
    wrap.className = `mp-pass is-${event?.theme ?? "hallows"}`;
    if (!event) return wrap;

    const next = nextTier(event, xp);
    const head = document.createElement("div");
    head.className = "mp-pass__head";
    head.innerHTML = `
      <div class="mp-pass__try">
        <span class="mp-pass__portrait" aria-hidden="true"></span>
        <span class="mp-pass__trying"></span>
        <span class="mp-pass__trying-kind"></span>
      </div>
      <div class="mp-pass__headbody">
        <p class="mp-pass__tagline"></p>
        <div class="mp-pass__stat">
          <span class="mp-pass__xp"></span>
          <span class="mp-pass__days"></span>
        </div>
        <div class="mp-pass__rail"><span class="mp-pass__fill"></span></div>
      </div>
    `;
    head.querySelector(".mp-pass__tagline").textContent = t(event.taglineKey);
    head.querySelector(".mp-pass__xp").textContent = t("events.pass.xp", { xp: fmtXp(xp) });
    const left = daysLeft(event);
    head.querySelector(".mp-pass__days").textContent = left === 1
      ? t("events.card.lastDay")
      : t("events.card.daysLeft", { n: left });
    const last = event.tiers[event.tiers.length - 1]?.xp || 1;
    head.querySelector(".mp-pass__fill").style.width = `${Math.round(Math.min(1, xp / last) * 100)}%`;
    wrap.appendChild(head);

    // An event switched on from the admin page says so, so a test run is
    // never mistaken for the real thing.
    if (event.simulated) {
      const sim = document.createElement("p");
      sim.className = "mp-pass__sim";
      sim.textContent = t("events.pass.simulated");
      wrap.appendChild(sim);
    }

    const portrait = head.querySelector(".mp-pass__portrait");
    const tryingLine = head.querySelector(".mp-pass__trying");
    const tryingKind = head.querySelector(".mp-pass__trying-kind");

    const list = document.createElement("ol");
    list.className = "mp-pass__list";

    // The track starts where the player started: a zero node, with the
    // first segment running from it to tier 1.
    const firstFill = event.tiers.length ? rungFill(event, event.tiers[0], xp) : 0;
    const zero = document.createElement("li");
    zero.className = "mp-pass__tier mp-pass__zero";
    zero.innerHTML = `
      <span class="mp-pass__spine" aria-hidden="true">
        <span class="mp-pass__rung mp-pass__rung--down"><span class="mp-pass__rung-fill" style="height:${Math.round(firstHalf(firstFill) * 100)}%"></span></span>
        <span class="mp-pass__node mp-pass__node--zero"></span>
      </span>
      <span class="mp-pass__zero-label"></span>
    `;
    zero.querySelector(".mp-pass__zero-label").textContent = t("events.pass.start");
    list.appendChild(zero);

    /** Dress the portrait in one tier's reward, or in nothing but the avatar. */
    function tryOn(step) {
      const rewards = step ? rewardsOf(event.id, step.tier) : [];
      portrait.innerHTML = rewardPortrait(avatar, rewards, { big: true });
      tryingLine.textContent = step
        ? t("events.pass.trying", { item: rewardNames(rewards, step.tier) })
        : t("events.pass.tryHint");
      tryingKind.textContent = step ? rewardKinds(rewards) : "";
      for (const el of list.children) el.classList.toggle("is-trying", !!step && el.dataset.tier === String(step.tier));
    }

    for (const step of event.tiers) {
      const rewards = rewardsOf(event.id, step.tier);
      const owned = xp >= step.xp;
      const isNext = next?.tier === step.tier;

      const fill = rungFill(event, step, xp);
      const nextStep = event.tiers.find((x) => x.tier === step.tier + 1);
      const fillOut = nextStep ? rungFill(event, nextStep, xp) : 0;
      const partial = fill >= 1 && fillOut > 0 && fillOut < 1;

      const li = document.createElement("li");
      li.className = `mp-pass__tier${owned ? " is-owned" : ""}${isNext ? " is-next" : ""}${partial ? " is-partial" : ""}`;
      li.dataset.tier = String(step.tier);
      // The spine runs the height of the row and carries the rung's fill,
      // so the line between two nodes is the progress between two tiers.
      li.innerHTML = `
        <span class="mp-pass__spine" aria-hidden="true">
          <span class="mp-pass__rung mp-pass__rung--up"><span class="mp-pass__rung-fill" style="height:${Math.round(secondHalf(fill) * 100)}%"></span></span>
          <span class="mp-pass__rung mp-pass__rung--down"><span class="mp-pass__rung-fill" style="height:${Math.round(firstHalf(fillOut) * 100)}%"></span></span>
          <span class="mp-pass__node"></span>
        </span>
        <button class="mp-pass__pick" type="button">
          <span class="mp-pass__art" aria-hidden="true">${rewardPortrait(avatar, rewards)}</span>
          <span class="mp-pass__meta">
            <span class="mp-pass__kind"></span>
            <span class="mp-pass__reward"></span>
            <span class="mp-pass__cost"></span>
          </span>
          <span class="mp-pass__state" aria-hidden="true">${owned ? CHECK_ICON : LOCK_ICON}</span>
        </button>
      `;
      li.querySelector(".mp-pass__node").textContent = String(step.tier);
      li.querySelector(".mp-pass__kind").textContent = rewardKinds(rewards);
      li.querySelector(".mp-pass__reward").textContent = rewardNames(rewards, step.tier);
      li.querySelector(".mp-pass__cost").textContent = owned
        ? t("events.pass.owned")
        : t("events.pass.xp", { xp: fmtXp(step.xp) });
      li.querySelector(".mp-pass__pick").addEventListener("click", () => tryOn(step));
      list.appendChild(li);
    }
    const scroll = document.createElement("div");
    scroll.className = "mp-pass__scroll";
    scroll.appendChild(list);
    wrap.appendChild(scroll);

    // Opens showing the player as they are, with a nudge to tap a tier.
    tryOn(null);

    const note = document.createElement("p");
    note.className = "mp-pass__note";
    note.textContent = t("events.pass.note");
    scroll.appendChild(note);
    return wrap;
  }

  document.addEventListener("i18n:changed", () => renderCard());

  return {
    element: root,

    /** cb() — the card was tapped; the controller opens the track. */
    setOnOpen(cb) { onOpen = cb; },

    /** The event to show, or null to hide the card entirely. */
    setEvent(next) { event = next; renderCard(); },

    setProgress({ xp: nextXp = 0, tier: nextTierNo = 0 } = {}) {
      xp = nextXp;
      tier = nextTierNo;
      renderCard();
    },

    /** The player's own avatar, so each tier previews on their character. */
    setAvatar(next) { avatar = next; },

    buildTrack,
  };
}
