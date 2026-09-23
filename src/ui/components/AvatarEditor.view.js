// src/ui/components/AvatarEditor.view.js
import { t } from "../../language/i18n.js";
import { AVATAR_SLOTS, WARDROBE_SLOTS, slotItems, itemNameKey, slotNameKey, isItemUnlocked } from "../../data/avatar.js";
import { BADGE_DEFINITIONS } from "../../data/badges.js";
import { tokenInfo } from "../../data/events.js";
import { avatarSvg } from "./Avatar.view.js";

// The badges page's glyphs, so a locked tile here matches a locked badge
// there.
const CHECK_ICON = `<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path fill="currentColor" d="M9.6 16.2 5.4 12l-1.4 1.4 5.6 5.6 12-12-1.4-1.4z"/></svg>`;
const LOCK_ICON = `<svg viewBox="0 0 24 24" width="11" height="11" aria-hidden="true"><path fill="currentColor" d="M17 9h-1V7a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2zm-7-2a2 2 0 1 1 4 0v2h-4V7z"/></svg>`;

/**
 * The avatar editor.
 *
 * Built like the badges page: a hero on the brand gradient with the avatar
 * itself and how much of the wardrobe is open, then one section per slot.
 * Colour slots are rows of swatches; the others are tiles, each showing the
 * whole avatar wearing that item rather than the item alone, so the player
 * sees the combination they would get. A locked badge item is shown, and
 * says which badge opens it — that is the whole point of a badge.
 *
 * A locked *event* item is not shown at all. Its window is the only way to
 * get it, so a row of padlocks no one can open would be a wall of things
 * the player has already missed; the event's own pass is where the player
 * sees what is still winnable, and can try it on. Once won, the item
 * appears here like any other and keeps its event caption.
 */
const SWATCH_SLOTS = new Set(["skin", "hairColor", "eyes"]);

export function createAvatarEditorView() {
  const root = document.createElement("section");
  root.className = "mp-wardrobe";

  let onSelect = null;

  /**
   * What an item asks for, as one shape the tiles and swatches can print:
   * an emoji, a caption and a tier for the ring colour. A badge names
   * itself; an event pass tier names its event and which tier it sits on,
   * and always wears the legendary ring — an event item is the rarest
   * thing in the wardrobe, since its window has closed.
   */
  function sourceOf(item) {
    if (!item.requires) return null;
    const ev = tokenInfo(item.requires);
    if (ev) {
      return {
        emoji: ev.event.emoji,
        label: `${t(ev.event.nameKey)} · ${t("events.pass.tierShort", { n: ev.tier })}`,
        tier: "legendary",
      };
    }
    const badge = BADGE_DEFINITIONS.find((b) => b.id === item.requires);
    return badge ? { emoji: badge.emoji, label: t(badge.nameKey), tier: badge.tier } : null;
  }

  /**
   * The items a slot shows: everything, less the event items still locked.
   * Counts and the hero total run off this too, so "7 of 9" never counts
   * something the page does not show.
   */
  function visibleItems(slot, unlockedSet) {
    return slotItems(slot).filter((item) => {
      if (isItemUnlocked(item, unlockedSet)) return true;
      return !tokenInfo(item.requires);
    });
  }

  function renderHero(avatar, unlockedSet) {
    const wardrobe = WARDROBE_SLOTS.flatMap((slot) => visibleItems(slot, unlockedSet));
    const total = wardrobe.length;
    const open = wardrobe.filter((it) => isItemUnlocked(it, unlockedSet)).length;

    const hero = document.createElement("div");
    hero.className = `mp-hero mp-wardrobe__hero${open === total ? " is-complete" : ""}`;
    hero.innerHTML = `
      <div class="mp-wardrobe__portrait" aria-hidden="true">${avatarSvg(avatar)}</div>
      <div class="mp-wardrobe__hero-body">
        <h1 class="mp-hero__title"></h1>
        <p class="mp-hero__subtitle"></p>
        <div class="mp-badges__rail" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${open}">
          <span class="mp-badges__fill" style="width:${total ? Math.round((open / total) * 100) : 0}%"></span>
        </div>
      </div>
    `;
    hero.querySelector(".mp-hero__title").textContent = t("avatar.title");
    hero.querySelector(".mp-hero__subtitle").textContent = open === total
      ? t("avatar.summary.complete")
      : t("avatar.summary.unlocked", { n: open, total });
    return hero;
  }

  function renderSwatch(slot, item, avatar, unlockedSet, index) {
    const unlocked = isItemUnlocked(item, unlockedSet);
    const selected = avatar[slot] === item.id;
    const badge = sourceOf(item);
    const name = t(itemNameKey(slot, item.id), { n: index + 1 });

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `mp-wardrobe__swatch ${unlocked ? "is-unlocked" : "is-locked"}${selected ? " is-selected" : ""}${item.stops ? " is-gradient" : ""}`;
    btn.style.setProperty("--swatch", item.stops
      ? `linear-gradient(145deg, ${item.stops.join(", ")})`
      : item.fill);
    btn.setAttribute("aria-pressed", String(selected));
    if (!unlocked) btn.setAttribute("aria-disabled", "true");
    btn.innerHTML = `
      <span class="mp-wardrobe__swatch-dot" aria-hidden="true">
        <span class="mp-wardrobe__swatch-state">${unlocked ? CHECK_ICON : LOCK_ICON}</span>
      </span>
      <span class="mp-wardrobe__swatch-cap"></span>
    `;
    // A colour that came from a badge says so, won or not — the same line
    // an outfit tile carries, so where a thing came from is never lost once
    // it is unlocked. A starter colour needs no caption at all.
    const cap = btn.querySelector(".mp-wardrobe__swatch-cap");
    if (badge) {
      cap.textContent = unlocked
        ? `${badge.emoji} ${badge.label}`
        : t("avatar.tile.lockedBy", { badge: `${badge.emoji} ${badge.label}` });
      btn.setAttribute("aria-label", `${name} — ${cap.textContent}`);
    } else {
      cap.remove();
      btn.setAttribute("aria-label", name);
    }
    btn.addEventListener("click", () => {
      if (!unlocked) return;
      onSelect?.(slot, item.id);
    });
    return btn;
  }

  function renderTile(slot, item, avatar, unlockedSet, index) {
    const unlocked = isItemUnlocked(item, unlockedSet);
    const selected = avatar[slot] === item.id;
    const badge = sourceOf(item);
    const name = t(itemNameKey(slot, item.id));

    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = `mp-wardrobe__tile mp-wardrobe__tile--${badge?.tier || "common"} ${unlocked ? "is-unlocked" : "is-locked"}${selected ? " is-selected" : ""}`;
    tile.style.animationDelay = `${Math.min(index, 16) * 24}ms`;
    tile.setAttribute("aria-pressed", String(selected));
    if (!unlocked) tile.setAttribute("aria-disabled", "true");
    tile.innerHTML = `
      <span class="mp-wardrobe__preview" aria-hidden="true">${avatarSvg({ ...avatar, [slot]: item.id })}</span>
      <span class="mp-wardrobe__state" aria-hidden="true">${unlocked ? CHECK_ICON : LOCK_ICON}</span>
      <span class="mp-wardrobe__kind"></span>
      <span class="mp-wardrobe__name"></span>
      <span class="mp-wardrobe__lock"></span>
    `;
    tile.querySelector(".mp-wardrobe__kind").textContent = t(slotNameKey(slot));
    tile.querySelector(".mp-wardrobe__name").textContent = name;

    const lockLine = tile.querySelector(".mp-wardrobe__lock");
    if (badge) {
      lockLine.textContent = unlocked
        ? `${badge.emoji} ${badge.label}`
        : t("avatar.tile.lockedBy", { badge: `${badge.emoji} ${badge.label}` });
      tile.setAttribute("aria-label", unlocked ? name : `${name} — ${lockLine.textContent}`);
    } else {
      lockLine.remove();
    }

    tile.addEventListener("click", () => {
      if (!unlocked) return;
      onSelect?.(slot, item.id);
    });
    return tile;
  }

  function render(avatar, unlockedSet) {
    root.replaceChildren(renderHero(avatar, unlockedSet));

    let index = 0;
    for (const slot of AVATAR_SLOTS) {
      const items = visibleItems(slot, unlockedSet);
      const section = document.createElement("section");
      section.className = `mp-wardrobe__group mp-wardrobe__group--${slot}`;
      section.innerHTML = `
        <div class="mp-badges__group-head">
          <h2 class="mp-badges__group-title"></h2>
          <span class="mp-badges__group-count"></span>
        </div>
        <div class="${SWATCH_SLOTS.has(slot) ? "mp-wardrobe__swatches" : "mp-wardrobe__grid"}"></div>
      `;
      section.querySelector(".mp-badges__group-title").textContent = t(`avatar.group.${slot}`);

      const grid = section.lastElementChild;
      const countEl = section.querySelector(".mp-badges__group-count");
      // Only a section with something to win gets a count.
      if (WARDROBE_SLOTS.includes(slot)) {
        const open = items.filter((it) => isItemUnlocked(it, unlockedSet)).length;
        countEl.textContent = `${open}/${items.length}`;
        if (open === items.length) section.classList.add("is-complete");
      } else {
        countEl.remove();
      }
      if (SWATCH_SLOTS.has(slot)) {
        items.forEach((item, i) => grid.appendChild(renderSwatch(slot, item, avatar, unlockedSet, i)));
      } else {
        for (const item of items) grid.appendChild(renderTile(slot, item, avatar, unlockedSet, index++));
      }
      root.appendChild(section);
    }
  }

  document.addEventListener("i18n:changed", () => {
    if (root._lastAvatar) render(root._lastAvatar, root._lastUnlocked);
  });

  function showStatus(text, { busy = false } = {}) {
    root.innerHTML = `<div class="mp-badges__status"></div>`;
    const box = root.firstElementChild;
    if (busy) {
      box.innerHTML = `<span class="fetch-loading"><span class="loading-spinner"></span></span>`;
      box.querySelector(".fetch-loading").append(text);
    } else {
      box.textContent = text;
    }
  }

  return {
    element: root,

    /** cb(slot, id) — only ever called for unlocked items. */
    setOnSelect(cb) { onSelect = cb; },

    update(avatar, unlockedSet = new Set()) {
      root._lastAvatar = avatar;
      root._lastUnlocked = unlockedSet;
      render(avatar, unlockedSet);
    },

    showLoading() {
      showStatus(t("avatar.loading"), { busy: true });
    },

    showError() {
      root._lastAvatar = null;
      showStatus(t("avatar.error"));
    },
  };
}
