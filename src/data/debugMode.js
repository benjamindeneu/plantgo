// src/data/debugMode.js
const KEY = "plantgo_debug_mode";

export const debugMode = {
  get() { return localStorage.getItem(KEY) === "true"; },
  set(val) {
    localStorage.setItem(KEY, String(!!val));
    document.body.classList.toggle("debug-mode", !!val);
  },
  init() { document.body.classList.toggle("debug-mode", this.get()); },
};
