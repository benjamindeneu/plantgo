// src/ui/components/SearchField.js

/** Case- and accent-blind, so "erable" finds "Érable" and "acer" finds Acer. */
export function fold(s) {
  return String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const SEARCH_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M10 3a7 7 0 0 1 5.6 11.2l4.6 4.6-1.4 1.4-4.6-4.6A7 7 0 1 1 10 3zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"/></svg>`;
const CLEAR_ICON = `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7l-1.4-1.4L9.2 12 2.9 5.7l1.4-1.4 6.3 6.3 6.3-6.3z"/></svg>`;

/**
 * The search pill the species lists filter with — the herbarium's and the
 * species page's. Filters as you type; the × empties it and puts the cursor
 * back. `onInput` gets the raw text, which the caller folds and matches.
 */
export function createSearchField({ onInput } = {}) {
  const root = document.createElement("label");
  root.className = "mp-search";
  root.innerHTML = `
    <span class="mp-search__icon">${SEARCH_ICON}</span>
    <input class="mp-search__input" type="search" autocomplete="off" autocorrect="off" spellcheck="false">
    <button class="mp-search__clear" type="button" hidden>${CLEAR_ICON}</button>
  `;
  const input = root.querySelector(".mp-search__input");
  const clearBtn = root.querySelector(".mp-search__clear");

  input.addEventListener("input", () => {
    clearBtn.hidden = !input.value;
    onInput?.(input.value);
  });
  clearBtn.addEventListener("click", () => {
    input.value = "";
    clearBtn.hidden = true;
    input.focus();
    onInput?.("");
  });

  return {
    element: root,
    setLabels({ placeholder, clear }) {
      input.placeholder = placeholder;
      input.setAttribute("aria-label", placeholder);
      clearBtn.setAttribute("aria-label", clear);
    },
  };
}
